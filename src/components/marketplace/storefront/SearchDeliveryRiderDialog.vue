<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom" full-height full-width>
    <q-card>
      <q-card-section class="q-pb-none">
        <div class="row items-center q-pb-sm">
          <div class="text-subtitle1 text-grey q-space">Search Riders</div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <q-input
          dense outlined
          :disable="fetchingRiders"
          :loading="fetchingRiders"
          label="Search radius" suffix="meters"
          v-model="searchOpts.radius"
          :rules="[
            val => val >= 0 || 'Inavlid',
          ]"
          :debounce="500"
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
            v-for="rider in riders" :key="selected?.id == rider?.id ? `selected-${rider?.id}` : rider?.id"
            :latLng="{
              lat: rider?.currentLocation?.[1],
              lng: rider?.currentLocation?.[0],
            }"
            :options="selected?.id == rider?.id ? { icon: selectedMarkerIcon } : undefined"
            @click="() => toggleSelected(rider)"
          />
        </LMap>
      </template>
      <q-list v-else>
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
import { LMap, LTileLayer, LMarker, LControl } from '@vue-leaflet/vue-leaflet'

export default defineComponent({
  name: 'SearchDeliveryRiderDialog',
  components: {
    LMap,
    LTileLayer,
    LMarker,
    LControl,
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

    watch(() => [props?.delivery?.id], () => searchRiderForDelivery())
    watch(searchOpts, () => searchRiderForDelivery(), { deep: true })
    onMounted(() => searchRiderForDelivery())

    const selected = ref(Rider.parse())
    function toggleSelected(rider=Rider.parse()) {
      if (selected.value?.id  == rider?.id) selected.value = null
      else selected.value = rider
    }

    const riders = ref([].map(Rider.parse))
    const fetchingRiders = ref(false)
    function searchRiderForDelivery() {
      const data = {
        delivery_id: props?.delivery?.id,
        radius: searchOpts.value?.radius,
      }
      const params = {}
      fetchingRiders.value = true
      return backend.post(`connecta-express/riders/search/`, data, { params })
        .then(response => {
          riders.value = response?.data?.results?.map?.(Rider.parse)
          return response
        })
        .finally(() => {
          fetchingRiders.value = false
        })
    }

    const map = ref()
    const mapView = ref(true)
    const mapState = ref({
      zoom: 13,
      center: [11.2674652, 124.9370791],
    })
    const selectedMarkerIcon = leaflet.icon.glyph({
      glyphSize: '1.5em',
      className: 'material-icons',
      prefix: '', glyph: 'check_circle',
    })
    const preferredBounds = computed(() => {
      const latitudes = riders.value.map(rider => rider?.currentLocation?.[1]).filter(lat => !isNaN(lat))
      const longitudes = riders.value.map(rider => rider?.currentLocation?.[0]).filter(lng => !isNaN(lng))
      const bottomLeft = [Math.min(...latitudes), Math.min(...longitudes)]
      const topRight = [Math.max(...latitudes), Math.max(...longitudes)]
      return [bottomLeft, topRight]
    })
    function centerMap() {
      map.value?.leafletObject?.fitBounds?.(preferredBounds.value)
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

      map,
      mapView,
      mapState,
      selectedMarkerIcon,
    }
  },
})
</script>
