<template>
  <div>
    <div
      v-for="review in reviews" :key="review?.id"
      class="q-mb-sm"
    >
      <div class="float-right text-grey text-caption">
        {{ formatDateRelative(review?.createdAt) }}
        <q-menu class="q-pa-sm">
          {{ formatTimestampToText(review?.createdAt) }}
        </q-menu>
      </div>
      <div class="text-caption top text-grey">{{ review?.authorName }}</div>
      <q-rating
        readonly
        max="5"
        :model-value="review?.rating * (5 / 100)"
        color="brandblue"
      />
      <div v-if="review?.text">{{ review?.text }}</div>
      <div v-else class="text-grey"><i>No message</i></div>
      <div class="row items-center no-wrap q-gutter-x-md" style="overflow:auto;">
        <q-img
          v-for="imageUrl in review?.imagesUrls" :key="imageUrl"
          :src="imageUrl"
          width="100px"
          ratio="1"
          class="rounded-borders"
          @click="() => openImage(imageUrl)"
        />
      </div>
      <q-separator spaced/>
    </div>
  </div>
</template>
<script>
import { Review } from 'src/marketplace/objects'
import { formatDateRelative, formatTimestampToText } from 'src/marketplace/utils'
import { useQuasar } from 'quasar'
import { defineComponent } from 'vue'
import ImageViewerDialog from '../ImageViewerDialog.vue'


export default defineComponent({
  name: 'ReviewsListPanel',
  props: {
    reviews: { type: Array, default: () => [].map(Review.parse) },
  },
  setup() {
    const $q = useQuasar()

    function openImage(img, title) {
      if (!img) return
      $q.dialog({
        component: ImageViewerDialog,
        componentProps: {
          image: img,
          title: title,
        }
      })  
    }

    return {
      openImage,

      formatDateRelative,
      formatTimestampToText,
    }
  },
})
</script>
