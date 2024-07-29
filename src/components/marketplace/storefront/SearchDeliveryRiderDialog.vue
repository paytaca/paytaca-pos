<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom" full-height full-width>
    <q-card>
      <q-card-section class="q-pb-none">
        <div class="row items-center q-pb-sm">
          <div class="text-subtitle1 text-grey q-space">Search Riders</div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <div class="text-body2 q-mb-xs">Search radius (in meters)</div>
        <q-btn-toggle
          no-caps
          v-model="searchOpts.radius"
          :disable="fetchingRiders"
          :loading="fetchingRiders"
          spread
          toggle-color="brandblue"
          class="q-mb-md"
          :options="[
            {label: '500m', value: 500},
            {label: '1km', value: 1000},
            {label: '5km', value: 5000},
            {label: '10km', value: 10000},
            {label: '20km', value: 20000},
          ]"
        />
        <div class="row items-center q-mb-sm">
          <q-space/>
          <q-btn-toggle
            padding="2px md"
            v-model="mapView"
            toggle-color="brandblue"
            :options="[
              {icon: 'map', value: true},
              {icon: 'list', value: false},
            ]"
          />
        </div>
        <div v-if="fetchingRiders" class="row items-center justify-center">
          <q-spinner size="sm"/>
        </div>
      </q-card-section>

      <template v-if="mapView">
        <LMap
          ref="map"
          v-model:zoom="mapState.zoom"
          v-model:center="mapState.center"
          style="height:50vh;width:100%;"
        >
          <LTileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            layer-type="base"
            name="OpenStreetMap"
          />
          <LControl v-if="selected?.id">
            <div class="bg-white text-black q-px-sm text-weight-medium">
              <div class="row items-center">
                <img
                  v-if="selected?.profilePictureUrl"
                  :src="selected?.profilePictureUrl"
                  class="rounded-borders q-my-xs q-mr-xs"
                  style="height:3rem;width:3rem;object-position:center;object-fit:cover;"
                />
                <span class="text-subtitle1 q-mr-xs">{{ selected?.firstName }} {{ selected?.lastName }}</span>
                <span class="text-grey">({{ (selected?.distance / 1000).toPrecision(3) }} km)</span>
                <q-btn
                  flat
                  padding="none"
                  icon="close"
                  @click="() => toggleSelected(selected)"
                />
              </div>
            </div>
          </LControl>
          <LMarker
            v-for="rider in ridersWithCoordinates" :key="selected?.id == rider?.id ? `selected-${rider?.id}` : rider?.id"
            :latLng="{
              lat: rider?.currentLocation?.[1],
              lng: rider?.currentLocation?.[0],
            }"
            :options="selected?.id == rider?.id ? { icon: selectedMarkerIcon } : undefined"
            @click="() => toggleSelected(rider)"
          />
          <LCircle
            :latLng="{
              lat: delivery?.pickupLocation?.latitude,
              lng: delivery?.pickupLocation?.longitude,
            }"
            color="red"
            :radius="searchOpts.radius"
          />
        </LMap>
      </template>
      <q-list v-else>
        <div v-if="!riders?.length" class="text-center text-grey q-py-md">
          No riders found
        </div>
        <q-item
          v-for="rider in riders" :key="rider?.id"
          clickable
          @click="() => toggleSelected(rider)"
        >
          <q-item-section side>
            <q-checkbox
              :model-value="selected?.id == rider?.id"
              @update:model-value="() => toggleSelected(rider)"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ rider?.firstName }} {{ rider?.lastName }}</q-item-label>
            <q-item-label class="text-caption text-grey">
              {{ (rider?.distance / 1000).toPrecision(3) }} km
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
      <q-card-section class="row items-center q-pt-sm">
        <q-btn
          flat
          no-caps
          label="Cancel"
          class="col-6"
          @click="onDialogCancel"
        />
        <q-btn
          no-caps
          label="Select"
          color="brandblue"
          class="col-6"
          @click="() => onDialogOK(selected)"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { Delivery, Rider } from 'src/marketplace/objects'
import { useDialogPluginComponent } from 'quasar'
import { defineComponent, onMounted, ref, watch, inject, computed } from 'vue'
import { LMap, LTileLayer, LMarker, LControl, LCircle } from '@vue-leaflet/vue-leaflet'

export default defineComponent({
  name: 'SearchDeliveryRiderDialog',
  components: {
    LMap,
    LTileLayer,
    LMarker,
    LControl,
    LCircle,
  },
  emits: [
    'update:modelValue',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  props: {
    modelValue: Boolean,
    delivery: Delivery,
    radius: { type: Number, default: 5000 },
  },
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    const leaflet = inject('$leaflet')

    const innerVal = ref(props?.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    const searchOpts = ref({
      radius: props?.radius,
    })
    watch(() => [searchOpts.value?.radius], () => centerMapBySearchRadius())

    watch(() => [props?.delivery?.id], () => searchRiderForDelivery())
    watch(searchOpts, () => searchRiderForDelivery(), { deep: true })
    onMounted(() => searchRiderForDelivery())

    const selected = ref(Rider.parse())
    function toggleSelected(rider=Rider.parse()) {
      if (selected.value?.id  == rider?.id) selected.value = null
      else selected.value = rider
    }

    const riders = ref([].map(Rider.parse))
    const ridersWithCoordinates = computed(() => {
      return riders.value.filter(rider => {
        return Number.isFinite(rider?.currentLocation?.[0]) && Number.isFinite(rider?.currentLocation?.[1])
      })
    })
    const fetchingRiders = ref(false)
    function searchRiderForDelivery() {
      const data = {
        pickup_location: {
          longitude: props?.delivery?.pickupLocation?.longitude,
          latitude: props?.delivery?.pickupLocation?.latitude,
        },
        radius: searchOpts.value?.radius,
        max_active_deliveries: 2,
      }
      const params = {}
      fetchingRiders.value = true
      return backend.post(`connecta-express/riders/find/`, data, { params })
        .then(response => {
          riders.value = response?.data?.map?.(Rider.parse)

          if (riders.value?.length != ridersWithCoordinates.value?.length) {
            mapView.value = false
          }
          return response
        })
        .finally(() => {
          fetchingRiders.value = false
        })
    }

    const map = ref()
    const mapView = ref(true)
    const mapState = ref({
      zoom: 18,
      center: [11.2674652, 124.9370791],
    })
    const selectedMarkerIcon = leaflet.icon.glyph({
      glyphSize: '1.5em',
      className: 'material-icons',
      prefix: '', glyph: 'check_circle',
    })
    const preferredBounds = computed(() => {
      const latitudes = riders.value.map(rider => rider?.currentLocation?.[1]).filter(lat => !Number.isNaN(lat))
      const longitudes = riders.value.map(rider => rider?.currentLocation?.[0]).filter(lng => !Number.isNaN(lng))
      const bottomLeft = [Math.min(...latitudes), Math.min(...longitudes)]
      const topRight = [Math.max(...latitudes), Math.max(...longitudes)]
      return [bottomLeft, topRight]
    })
    function centerMap() {
      if (!preferredBounds.value[0].every(Number.isFinite) || preferredBounds.value[1].every(Number.isFinite)) {
        return centerMapBySearchRadius()
      }
      map.value?.leafletObject?.fitBounds?.(preferredBounds.value)
    }

    function centerMapBySearchRadius() {
      const lat = parseFloat(props.delivery?.pickupLocation?.latitude)
      const lng = parseFloat(props.delivery?.pickupLocation?.longitude)
      if (!Number.isFinite(lat)) return
      if (!Number.isFinite(lng)) return

      // 500 -> 15
      // 1000 -> 14
      // 5000 -> 12
      // 10000 -> 11
      // 20000 -> 10
      // Formula below is based on testing of ideal radius and zoom level
      const MAX_ZOOM = 18
      const radius = searchOpts.value.radius
      const zoom = Math.floor(MAX_ZOOM - Math.log2(radius / 125))
      const center = [lat,lng]

      if (map.value?.leafletObject?.setView) {
        map.value?.leafletObject?.setView(center, zoom, { animate: true, duration: 1 })
      }  else mapState.value = { center, zoom }
    }

    watch(preferredBounds, () => centerMap(), { deep: true })

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      searchOpts,
      selected,
      toggleSelected,
      fetchingRiders,
      riders,
      ridersWithCoordinates,

      map,
      mapView,
      mapState,
      selectedMarkerIcon,
    }
  },
})
</script>
