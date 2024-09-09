<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card>
      <q-card-section>
        <slot name="title" v-bind="{ userImage, user }">
          <div class="row items-center">
            <img
              :src="userImage" style="width:50px"
              class="rounded-borders q-mr-sm"
            />
            <div class="text-subtitle1">
                {{ user.fullName || user?.username || user?.email }}
                <span class="text-grey">#{{ user.id }}</span>
            </div>
          </div>
        </slot>
        
        <slot v-bind="{ userImage, user, userRoles }">
          <div class="row q-gutter-md q-mt-sm">
            <div class="user-info-attribute">
              <div>{{ user.firstName }}</div>
              <div class="text-caption text-grey">{{ $t('FirstName') }}</div>
            </div>
            <div class="user-info-attribute">
              <div>{{ user.lastName }}</div>
              <div class="text-caption text-grey">{{ $t('LastName') }}</div>
            </div>
          </div>
          <div v-if="user.username" class="user-info-attribute">
            <div>{{ user.username }}</div>
            <div class="text-caption text-grey">{{ $t('Username') }}</div>
          </div>
          <div v-if="user.email" class="user-info-attribute">
            <div>{{ user.email }}</div>
            <div class="text-caption text-grey">{{ $t('Email') }}</div>
          </div>
          <div v-if="userRoles?.length" class="user-info-attribute">
            <div class="q-mt-xs q-gutter-sm">
              <q-badge v-for="(role, index) in userRoles" :key="index">
                {{ formatRole(role) }}
              </q-badge>
            </div>
            <div class="text-caption text-grey">{{ $t('Roles') }}</div>
          </div>
        </slot>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { User } from 'src/marketplace/objects'
import { computed, defineComponent } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { formatRole } from 'src/marketplace/utils'

export default defineComponent({
  name: 'UserInfoDialog',
  emits: [
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits
  ],
  props: {
    user: User,
    shopId: Number, 
  },
  setup(props) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const userImage = computed(() => {
      if (props.user?.profilePictureUrl) return props.user?.profilePictureUrl
      const fullName = `${props.user?.firstName} ${props.user?.lastName}`
      return `https://api.dicebear.com/5.x/initials/svg?seed=${fullName}`
    })

    const userRoles = computed(() => {
      const shopRole = props.user.shopRoles?.find?.(shopRole => shopRole?.shopId === props.shopId)

      if (!Array.isArray(shopRole?.roles)) return []
      return shopRole.roles
    })

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,

      userImage,
      userRoles,

      // utils funcs
      formatRole,
    }
  },
})
</script>
<style scoped>
.user-info-attribute > .text-caption:last-child {
  margin-top: -0.5em;
}
.user-info-attribute > .text-caption:first-child {
  margin-bottom: -0.5em;
}
</style>
