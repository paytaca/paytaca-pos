<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card>
      <q-card-section>
        <div class="row items-center q-pb-sm">
          <div class="text-h5 q-space">{{ $t('DeliveryAddress', {}, 'Delivery address' )}}</div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <q-form ref="form" @submit="() => submit()">
          <q-banner v-if="formErrors?.detail?.length" class="bg-red text-white rounded-borders q-mb-md">
            <div v-if="formErrors?.detail?.length === 1">
              {{ formErrors?.detail?.[0] }}
            </div>
            <ul v-else class="q-pl-md">
              <li v-for="(err, index) in formErrors?.detail" :key="index">{{err}}</li>
            </ul>
          </q-banner>
          <div class="row items-center q-mb-sm">
            <div class="text-subtitle1">{{ $t('Contact') }}</div>
            <q-space/>
          </div>
          <div class="row items-start">
            <q-input
              outlined
              dense
              :disable="loading"
              :label="$t('FirstName') + '*'"
              v-model="formData.firstName"
              class="col-12 col-sm-6"    
              :error="Boolean(formErrors?.firstName)"
              :error-message="formErrors?.firstName"
              :rules="[
                val => Boolean(val) || $t('Required'),
              ]"
            /> 
            <q-input
              outlined
              dense
              :disable="loading"
              :label="$t('LastName') + '*'"
              v-model="formData.lastName"
              class="col-12 col-sm-6"
              :error="Boolean(formErrors?.lastName)"
              :error-message="formErrors?.lastName"
              :rules="[
                val => Boolean(val) || $t('Required'),
              ]"
            />
          </div>
          <q-input
            outlined
            dense
            :disable="loading"
            :label="$t('PhoneNumber') + '*'"
            v-model="formData.phoneNumber"
            :error="Boolean(formErrors?.phoneNumber)"
            :error-message="formErrors?.phoneNumber"
            :rules="[
              val => !val || String(val).match(/^(0|(\+\d+))\d{3}-?\d{3}-?\d{4}$/) || $t('InvalidPhoneNumber', {}, 'Invalid phone number'),
            ]"
            @update:model-value="() => showNumberCodeSelector = true"
          />
          
          <div class="row items-center q-mb-sm">
            <div class="text-subtitle1">{{ $t('Address') }}</div>
            <q-space/>
            <!-- <GeolocateBtn @geolocate="position => onGeolocate(position)"/> -->
          </div>

          <q-input
            outlined
            dense
            :disable="loading"
            :label="$t('Address')"
            v-model="formData.location.address1"
            :error="Boolean(formErrors.location?.address1)"
            :error-message="formErrors?.location?.address1"
          />
          <div class="row items-start">
            <q-input
              outlined
              dense
              :disable="loading"
              :label="$t('Street') + '*'"
              v-model="formData.location.street"
              class="col-12 col-sm-6"
              :error="Boolean(formErrors?.location?.street)"
              :error-message="formErrors?.location?.street"
              :rules="[
                val => Boolean(val) || $t('Required'),
              ]"
            />
            <q-input
              outlined
              dense
              :disable="loading"
              :label="$t('City') + '*'"
              v-model="formData.location.city"
              class="col-12 col-sm-6"
              :error="Boolean(formErrors?.location?.city)"
              :error-message="formErrors?.location?.city"
              :rules="[
                // val => Boolean(val) || $t('Required'),
              ]"
            />
          </div>

          <div class="row items-start">
            <q-input
              outlined
              dense
              :disable="loading"
              :label="`${$t('State')} / ${$t('Province')} *`"
              v-model="formData.location.state"
              class="col-12 col-sm-6"
              :error="Boolean(formErrors?.location?.state)"
              :error-message="formErrors?.location?.state"
              :rules="[
                val => Boolean(val) || $t('Required'),
              ]"
            />
            <CountriesFieldWrapper v-slot="{ filteredCountriesOpts, filterCountriesOpts }">
              <q-select
                outlined
                dense
                :disable="loading"
                :label="$t('Country') + '*'"
                clearable
                use-input
                fill-input
                hide-selected
                :options="filteredCountriesOpts"
                @filter="filterCountriesOpts"
                v-model="formData.location.country"
                class="col-12 col-sm-6"
                :error="Boolean(formErrors?.location?.country)"
                :error-message="formErrors?.location?.country"
                :rules="[
                  val => Boolean(val) || $t('Required'),
                ]"
              />
            </CountriesFieldWrapper>
          </div>
          <div class="row items-center q-gutter-x-sm q-mt-sm">
            <q-btn
              no-caps flat
              :disable="loading"
              class="q-space"
              @click="selectCoordinates()"
            >
              <q-icon name="location_on"/>
              <template v-if="validCoordinates">
                {{ formData.location.latitude }}, {{ formData.location.longitude }}
              </template>
              <template v-else>
                {{ $t('PinLocation', {}, 'Pin location') }}
              </template>
            </q-btn>
            <q-btn
              v-if="validCoordinates"
              :disable="loading"
              icon="close"
              padding="xs"
              flat
              @click="() => {
                formData.location.longitude = null
                formData.location.latitude = null
              }"
            />
          </div>
          <q-btn
            :disable="loading"
            :loading="loading"
            no-caps :label="$t('Save')"
            color="brandblue"
            class="full-width"
            type="submit"
          />
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { Order } from 'src/marketplace/objects'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import CountriesFieldWrapper from 'src/components/CountriesFieldWrapper.vue'
import PinLocationDialog from '../PinLocationDialog.vue'
import { backend } from 'src/marketplace/backend'
import { errorParser } from 'src/marketplace/utils'

export default defineComponent({
  name: 'UpdateOrderDeliveryAddressFormDialog',
  components: {
    CountriesFieldWrapper,
  },
  props: {
    modelValue: Boolean,
    order: Order,
  },
  emits: [
    'update:modelValue',
    'updated',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props, { emit: $emit }) {
    const { t: $t } = useI18n()
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    const $q = useQuasar()

    onMounted(() => resetFormData())
    watch(innerVal, () => {
      if (!innerVal.value) return
      resetFormErrors()
      resetFormData()
    })

    const loading = ref(false)
    const form = ref()
    const formData = ref({
      firstName: '',
      lastName: '',
      phoneNumber: '',
      location: {
        address1: '',
        address2: '',
        street: '',
        city: '',
        state: '',
        country: '',
        latitude: null,
        longitude: null,
      },
    })

    function resetFormData() {
      const deliveryAddress = props.order?.deliveryAddress
      formData.value = {
        firstName: deliveryAddress?.firstName || '',
        lastName: deliveryAddress?.lastName || '',
        phoneNumber: deliveryAddress?.phoneNumber || '',
        location: {
          address1: deliveryAddress?.location?.address1 || '',
          address2: deliveryAddress?.location?.address2 || '',
          street: deliveryAddress?.location?.street || '',
          city: deliveryAddress?.location?.city || '',
          state: deliveryAddress?.location?.state || '',
          country: deliveryAddress?.location?.country || '',
          latitude: parseFloat(deliveryAddress?.location?.latitude) || null,
          longitude: parseFloat(deliveryAddress?.location?.longitude) || null,
        }
      }
      setTimeout(() => form.value?.resetValidation(), 10)
    }

    function createEmptyFormErrors() {
      return {
        detail: [],
        firstName: '',
        lastName: '',
        phoneNumber: '',
        location: {
          address1: '',
          address2: '',
          street: '',
          city: '',
          state: '',
          country: '',
          latitude: '',
          longitude: '',
        }
      }
    }
    const formErrors = ref(createEmptyFormErrors())
    function resetFormErrors() {
      formErrors.value = createEmptyFormErrors()
    }

    const validCoordinates = computed(() => {
      const lat = formData.value?.location?.latitude
      const lon = formData.value?.location?.longitude
      return Number.isFinite(lat) && Number.isFinite(lon)
    })
    function selectCoordinates() {
      $q.dialog({
        component: PinLocationDialog,
        componentProps: {
          initLocation: {
            latitude: formData.value.location.latitude,
            longitude: formData.value.location.longitude,
          }
        }
      })
        .onOk(coordinates => {
          formData.value.location.longitude = coordinates.lng
          formData.value.location.latitude = coordinates.lat
        })
    }

    function submit() {
      const orderId = props.order?.id
      const data = {
        delivery_address: {
          first_name: formData.value.firstName,
          last_name: formData.value.lastName,
          phone_number: formData.value.phoneNumber,
          location: {
            address1: formData.value.location.address1,
            address2: formData.value.location.address2,
            street: formData.value.location.street,
            city: formData.value.location.city,
            state: formData.value.location.state,
            country: formData.value.location.country,
            latitude: formData.value.location.latitude,
            longitude: formData.value.location.longitude,
          }
        }
      }

      loading.value = true
      return backend.patch(`connecta/orders/${orderId}/`, data)
        .finally(() => resetFormErrors())
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          $emit('updated', response?.data)
          return response
        })
        .catch(error => {
          const data = error?.response?.data
          if (!data) {
            formErrors.value.detail = [
              $t('EncounteredError'),
              error?.message,
            ].filter(Boolean)
            return
          }
          formErrors.value = {
            detail: errorParser.toArray(data?.non_field_errors),
            firstName: errorParser.firstElementOrValue(data?.delivery_address?.first_name),
            lastName: errorParser.firstElementOrValue(data?.delivery_address?.last_name),
            phoneNumber: errorParser.firstElementOrValue(data?.delivery_address?.phone_number),
            location: {
              address1: errorParser.firstElementOrValue(data?.delivery_address?.location?.address1),
              address2: errorParser.firstElementOrValue(data?.delivery_address?.location?.address2),
              street: errorParser.firstElementOrValue(data?.delivery_address?.location?.street),
              city: errorParser.firstElementOrValue(data?.delivery_address?.location?.city),
              state: errorParser.firstElementOrValue(data?.delivery_address?.location?.state),
              country: errorParser.firstElementOrValue(data?.delivery_address?.location?.country),
              latitude: errorParser.firstElementOrValue(data?.delivery_address?.location?.latitude),
              longitude: errorParser.firstElementOrValue(data?.delivery_address?.location?.longitude),
            }
          }

          if (!formErrors.value.length) formErrors.value.length = errorParser.toArray(data?.delivery_address)
        })
        .finally(() => {
          loading.value = false
        })
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      loading,
      form,
      formData,
      
      formErrors,
      resetFormErrors,
      
      validCoordinates,
      selectCoordinates,

      submit,
    }
  },
})
</script>
