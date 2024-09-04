<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
          <div class="q-space">
            <div class="text-h5">{{ $t('Staff') }}</div>
            <div class="text-grey">{{ $t('Marketplace') }}</div>
          </div>
        </template>
      </MarketplaceHeader>
      <div class="full-width q-px-sm q-mb-sm">
        <div class="row items-end q-mb-md q-gutter-sm">
          <q-input
            dense
            v-model="filterOpts.search"
            debounce="500"
          >
            <template v-slot:prepend><q-icon name="search"/></template>
          </q-input>
          <q-space/>
          <q-btn round icon="add" padding="sm" color="brandblue" @click="openAddUserDialog()"/>
        </div>
      </div>
      <div class="q-mb-md">
        <q-chip class="ellipsis">
          <template v-if="!filterOpts.roles?.length">
            {{ $t('FilterRoles') }}
          </template>
          <template v-else>
            {{ filterOpts.roles.map(formatRole).join(', ') }}
          </template>
          <q-menu class="q-pa-sm" ref="roleFilterMenu">
            <q-option-group
              v-model="filterOpts.roles"
              :options="roleOpts"
              type="checkbox"
              @update:model-value="() => repositionRoleFilterMenu()"
            />
          </q-menu>
        </q-chip>
      </div>
      <q-table
        ref="table"
        :loading="fetchingStaff"
        :loading-label="$t('Loading')"
        :columns="staffTableColumns"
        :rows="staff"
        row-key="id"
        :pagination="{ rowsPerPage: 0 }"
        hide-pagination
        binary-state-sort
        :sort-method="sortMethod"
      >
        <template v-slot:bottom>
          <div class="row items-center full-width">
            <q-space/>
            <LimitOffsetPagination
              :pagination-props="{
                maxPages: 5,
                rounded: true,
                padding: 'sm md',
                flat: true,
                boundaryNumbers: true
              }"
              :hide-below-pages="2"
              :modelValue="staffPagination"
              @update:modelValue="fetchStaff"
            />
          </div>
        </template>
        <template v-slot:body-cell-name="props">
          <q-td :props="props">
            <q-btn no-caps flat @click="() => displayStaffInfo(props.row)" padding="0" no-wrap>
              {{ props.row.fullName || props.row.username }} 
              <q-icon v-if="props.row?.hasPassword === false" name="key_off" size="1em" class="q-ml-xs text-grey"/>
            </q-btn>
          </q-td>
        </template>
        <template v-slot:body-cell-roles="props">
          <q-td :props="props">
            <q-spinner v-if="props.row?.$state?.updating"/>
            {{ props.row?.getRolesFromShop(marketplaceStore.activeShopId)?.map?.(formatRole)?.join?.(', ') }}
            <q-popup-edit
              :cover="false"
              :model-value="props.row?.getRolesFromShop(marketplaceStore.activeShopId)"
              @update:model-value="val => updateStaffRoles(props.row, val)"
              v-slot="scope"
            >
              <div class="text-subtitle1">Roles</div>
              <div v-for="(roleOpt, index) in getUpdateRoleOpts(props.row)" :key="index">
                <q-checkbox
                  v-model="scope.value"
                  :label="roleOpt.label"
                  :val="roleOpt.value"
                  :disable="roleOpt.disabled"
                />
              </div>
              <q-btn
                no-caps
                :label="$t('Update')"
                color="brandblue"
                class="full-width"
                @click="scope.set"
              />
            </q-popup-edit>
          </q-td>
        </template>
      </q-table>
    </q-pull-to-refresh>
    <UserInfoDialog
      v-model="userInfoDialog.show"
      :user="userInfoDialog.user"
      :shop-id="marketplaceStore?.activeShopId"
      v-slot="{ userRoles, user }"
    >
      <div class="q-mt-md">
        <q-banner
          v-if="typeof user?.hasPassword === 'boolean'"
          dense
          :class="[
            'q-mb-sm rounded-borders text-caption',
            $q.dark.isActive ? 'bg-brandblue' : 'shadow-2',
          ]"
        >
          <template v-slot:avatar>
            <q-icon :name="user?.hasPassword ? 'key' : 'key_off'"/>
          </template>
          <template v-if="user?.hasPassword">
            This account requires password to sign-in
          </template>
          <template v-else>
            This account does not require a password to sign-in
          </template>
        </q-banner>
        <div v-if="userRoles?.length" class="q-mb-sm">
          <div class="q-gutter-sm">
            <q-badge v-for="(role, index) in userRoles" :key="index">
              {{ formatRole(role) }}
            </q-badge>
          </div>
        </div>
        <div v-if="user.username" class="q-mb-sm">
          <div>{{ user.username }}</div>
          <div class="text-caption bottom text-grey">{{ $t('Username') }}</div>
        </div>
        <div v-if="user.email" class="q-mb-sm">
          <div>{{ user.email }}</div>
          <div class="text-caption bottom text-grey">{{ $t('Email') }}</div>
        </div>
        <div v-if="marketplaceStore.userPermissions.admin && user?.id !== marketplaceStore?.user?.id">
          <q-btn
            no-caps label="Delete"
            color="red"
            v-close-popup
            @click="() => removeUserAsStaff(user)"
          />
        </div>
      </div>
    </UserInfoDialog>
  </q-page>
</template>
<script>
import { User } from 'src/marketplace/objects'
import { backend } from 'src/marketplace/backend'
import { formatRole } from 'src/marketplace/utils'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useMarketplaceStore } from 'src/stores/marketplace'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import UserInfoDialog from 'src/components/marketplace/UserInfoDialog.vue'
import LimitOffsetPagination from 'src/components/LimitOffsetPagination.vue'
import AddStaffFormDialog from 'src/components/marketplace/staff/AddStaffFormDialog.vue'

export default defineComponent({
  components: {
    MarketplaceHeader,
    LimitOffsetPagination,
    UserInfoDialog,
  },
  setup() {
    const $q = useQuasar()
    const { t } = useI18n()
    const marketplaceStore = useMarketplaceStore()

    const roleOpts = computed(() => {
      return Object.values(marketplaceStore.roles).map(role => {
        return { value: role, label: formatRole(role) }
      })
    })

    const roleFilterMenu = ref()
    function repositionRoleFilterMenu() {
      setTimeout(() => {
        roleFilterMenu.value?.updatePosition?.()
      }, 10)
    }

    const filterOpts = ref({
      sort: undefined,
      search: '',
      roles: [],
    })
    watch(filterOpts, () => fetchStaff(), { deep: true })

    const fetchingStaff = ref(false)
    const staff = ref([].map(User.parse))
    const staffPagination = ref({ count: 0, limit: 0, offset: 0 })

    onMounted(() => fetchStaff())
    function fetchStaff(opts = {limit: 0, offset: 0}) {
      const params = {
        limit: opts?.limit || 10,
        offset: opts?.offset || undefined,
        ordering: filterOpts.value.sort || undefined,
        s: filterOpts.value.search || undefined,
      }
      if (filterOpts.value.roles?.length) params.roles = filterOpts.value.roles.join(',')

      fetchingStaff.value = true
      return backend.get(`shops/${marketplaceStore.activeShopId}/staff/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          staff.value = response?.data?.results.map(User.parse)
          staffPagination.value.limit = response?.data?.limit
          staffPagination.value.offset = response?.data?.offset
          staffPagination.value.count = response?.data?.count
          return response
        })
        .finally(() => {
          fetchingStaff.value = false
        })
    }

    const table = ref()
    const staffTableColumns = [
      {
        name: 'name',
        align: 'left',
        label: t('Name'),
        field: 'fullName',
        sortable: true,
      },
      {
        name: 'roles',
        align: 'left',
        label: t('Roles'),
        field: obj => obj?.getRolesFromShop(marketplaceStore.activeShopId),
        format: val => Array.isArray(val) ? val.map(formatRole).join(', ') : '',
      },
      { name: 'username',
        align: 'center',
        label: t('Username'),
        field: 'username',
        sortable: true
      },
      { name: 'email',
        align: 'center',
        label: t('Email'),
        field: 'email',
        sortable: true
      },
    ]
    const sortFieldNameMap = {
      items: 'items_count',
      'payment-mode': 'payment_mode',
    }
    function sortMethod(rows, sortBy, descending) {
      const fieldName = sortFieldNameMap[sortBy] || sortBy
      filterOpts.value.sort = (descending ? '-': '') + fieldName
      return rows
    }

    const userInfoDialog = ref({ show: false, user: User.parse() })
    function displayStaffInfo(staff=User.parse()) {
      userInfoDialog.value = { show: true, user: staff }
    }

    function openAddUserDialog() {
      $q.dialog({
        component: AddStaffFormDialog,
      }).onOk(() => fetchStaff())
    }

    function getUpdateRoleOpts(staffObj=User.parse()) {
      const _roleOpts = roleOpts.value.map(opt => Object.assign({}, opt))
        .map(opt => {

          if (staffObj?.id === marketplaceStore?.user?.id) {
            if (opt.value === marketplaceStore.roles.admin) opt.disabled = true
          }
          return opt
        })
        .filter(opt => {
          const isAdminOpt = opt.value === marketplaceStore.roles.admin
          if (staffObj.hasPassword === false && isAdminOpt) {
            return false
          }
          return true
        })
        return _roleOpts
    }

    function updateStaffRoles(staffObj=User.parse(), roles=[]) {
      const data = {
        user_id: staffObj?.id,
        shop_id: marketplaceStore.activeShopId,
        roles: roles,
      }
      if (staffObj.$state) staffObj.$state.updating = true
      backend.post(`users/shop_roles/`, data)
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          staff.value.forEach(_staff => {
            if (_staff?.id === response?.data?.id) _staff.raw = response?.data
          })
          return response
        })
        .then(() => {
          if (staffObj?.id === marketplaceStore.user?.id) marketplaceStore.refreshUser()
        })
        .catch(error => {
          let errorMsg = error?.response?.data?.detail
          if (error?.response?.status === 403 && !errorMsg) {
            errorMsg = t('AdminPermissionErrMsg')
          }

          $q.notify({
            message: errorMsg || t('RoleUpdateErrorMsg'),
            type: 'negative',
          })
        })
        .finally(() => {
          if (staffObj.$state) staffObj.$state.updating = false
        })
    }

    function removeUserAsStaff(staffObj=User.parse()) {
      const dialog = $q.dialog({
        color: 'brandblue',
        message: 'Removing user from shop',
        progress: true,
        ok: false,
        cancel: false,
        persistent: true,
      })

      return backend.delete(`users/${staffObj.id}/shop_roles/${marketplaceStore.activeShopId}/`)
        .then(response => {
          fetchStaff()
          dialog.hide()
          return response
        })
        .finally(() => {
          dialog.update({ ok: true, persistent: false, progress: false })
        })
    }

    async function refreshPage(done) {
      try {
        await fetchStaff()
      } finally {
        done()
      }
    }

    return {
      marketplaceStore,
      roleOpts,
      roleFilterMenu,
      repositionRoleFilterMenu,
      filterOpts,
      fetchingStaff,
      staff,
      staffPagination,
      fetchStaff,
      table,
      staffTableColumns,
      sortMethod,

      userInfoDialog,
      displayStaffInfo,
      openAddUserDialog,
      getUpdateRoleOpts,
      updateStaffRoles,
      removeUserAsStaff,
      refreshPage,

      // utils funcs
      formatRole,
    }
  },
})
</script>
