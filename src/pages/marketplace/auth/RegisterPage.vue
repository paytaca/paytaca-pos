<template>
  <q-page
    class="q-pa-md"
    style="
      padding-top: calc(1rem + constant(safe-area-inset-top));
      padding-top: calc(1rem + env(safe-area-inset-top));
    "
  >
    <div class="row items-center q-mt-sm q-mb-md">
      <q-btn
        flat
        round
        icon="arrow_back"
        @click="$router.push({ name: 'home' })"
        class="q-mr-sm"
      />
      <div class="q-space">
        <div class="text-h4">{{ $t("Marketplace") }}</div>
      </div>
    </div>
    <q-card>
      <q-card-section>
        <div class="text-h5">{{ $t("Register") }}</div>
        <div>{{ marketplaceStore?.shop?.name }}</div>
        <div class="q-pb-md q-pt-sm">
          <q-separator />
        </div>
        <q-form @submit="() => register()">
          <div v-if="errors.detail?.length > 0" class="q-py-sm">
            <div class="bg-red q-px-sm q-py-md rounded-borders">
              <div
                v-for="(error, index) in errors?.detail"
                :key="index"
                style="word-break: break-word"
              >
                {{ error }}
              </div>
            </div>
          </div>
          <!-- <q-select
            v-if="marketplaceStore.activeShopId"
            dense
            outlined
            label="Register as"
            :options="roleOpts"
            map-options
            emit-value
            v-model="formData.role"
            :error="Boolean(errors?.role)"
            :error-message="errors?.role"
          /> -->

          <q-input
            dense
            outlined
            :disable="loading"
            :label="$t('Username')"
            v-model="formData.username"
            :error="Boolean(errors?.username)"
            :error-message="errors?.username"
          />
          <q-input
            dense
            outlined
            :disable="loading"
            :label="$t('Password')"
            type="password"
            v-model="formData.password"
            autocomplete="on"
            :error="Boolean(errors?.password)"
            :error-message="errors?.password"
          />
          <q-input
            dense
            outlined
            :disable="loading"
            :label="$t('ConfirmPassword')"
            type="password"
            v-model="formData.confirmPassword"
            autocomplete="on"
            reactive-rules
            :rules="[
              (val) => val === formData.password || $t('PasswordDoesntMatch'),
            ]"
          />

          <q-separator spaced />

          <q-input
            dense
            outlined
            :disable="loading"
            :label="$t('Email')"
            v-model="formData.email"
            :error="Boolean(errors?.email)"
            :error-message="errors?.email"
          />
          <q-input
            dense
            outlined
            :disable="loading"
            :label="$t('FirstName')"
            v-model="formData.firstName"
            :error="Boolean(errors?.firstName)"
            :error-message="errors?.firstName"
          />
          <q-input
            dense
            outlined
            :disable="loading"
            :label="$t('LastName')"
            v-model="formData.lastName"
            :error="Boolean(errors?.lastName)"
            :error-message="errors?.lastName"
          />
          <div>
            <q-btn
              :disable="loading"
              :loading="loading"
              type="submit"
              no-caps
              color="brandblue"
              :label="$t('Register')"
              class="full-width"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-page>
</template>
<script>
import { backend } from "src/marketplace/backend";
import { User } from "src/marketplace/objects";
import { errorParser } from "src/marketplace/utils";
import { useQuasar } from "quasar";
import { computed, defineComponent, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useMarketplaceStore } from "src/stores/marketplace";
import { useI18n } from "vue-i18n";

export default defineComponent({
  name: "RegisterPage",
  setup() {
    const $q = useQuasar();
    const { t } = useI18n();
    const $router = useRouter();
    const marketplaceStore = useMarketplaceStore();
    onMounted(() => marketplaceStore.refetchShop());

    const roleOpts = computed(() => {
      const roles = marketplaceStore.roles;
      return [
        { value: roles.admin, label: t("Admin") },
        { value: roles.inventory, label: t("InventoryManager") },
        { value: roles.cashier, label: t("Cashier") },
      ];
    });

    const loading = ref(false);
    const formData = ref({
      // role: '',
      username: "",
      email: "",
      firstName: "",
      lastName: "",
      password: "",
      confirmPassword: "",
    });

    const errors = ref({
      detail: [],
      // role: '',
      username: "",
      password: "",

      email: "",
      firstName: "",
      lastName: "",
    });

    function register() {
      const data = {
        // roles: [],
        shop_id: marketplaceStore.activeShopId || -1,
        username: formData.value.username,
        password: formData.value.password,
        email: formData.value.email,
        first_name: formData.value.firstName,
        last_name: formData.value.lastName,
      };

      // if (formData.value.role) data.roles = [formData.value.role]

      loading.value = true;
      backend
        .post("users/register/", data)
        .then((response) => {
          if (!response?.data?.id) return Promise.reject({ response });
          const user = User.parse(response?.data);
          const roles = user.getRolesFromShop(marketplaceStore.activeShopId);
          $q.dialog({
            color: "brandblue",
            title: "Registered!",
            message: roles.length
              ? "Registration successful!"
              : "Contact a shop admin to assign a role/position to your account.",
            ok: true,
          }).onDismiss(() => {
            $router.push({
              name: "marketplace-login",
              query: {
                username: response?.data?.username,
              },
            });
          });
          return response;
        })
        .catch((error) => {
          if (error?.response?.data) {
            const data = error?.response?.data;
            errors.value.detail = errorParser.toArray(data?.non_field_errors);
            // errors.value.role = errorParser.firstElementOrValue(data?.roles)
            errors.value.username = errorParser.firstElementOrValue(
              data?.username
            );
            errors.value.password = errorParser.firstElementOrValue(
              data?.password
            );
            errors.value.email = errorParser.firstElementOrValue(data?.email);
            errors.value.firstName = errorParser.firstElementOrValue(
              data?.first_name
            );
            errors.value.lastName = errorParser.firstElementOrValue(
              data?.last_name
            );

            if (Array.isArray(data)) errors.value.detail = data;
            if (data?.detail) errors.value.detail = [data?.detail];
            if (!errors.value.detail?.length) {
              errors.value.detail = ["Encountered errors"];
            }
          }
          return Promise.reject(error);
        })
        .finally(() => {
          loading.value = false;
        });
    }

    return {
      marketplaceStore,
      roleOpts,
      loading,
      formData,
      errors,
      register,
    };
  },
});
</script>
