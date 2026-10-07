<template>
  <div class="wheel-column">
    <div class="wheel-column__highlight" />
    <div
      ref="scrollRef"
      class="wheel-column__scroll"
      @scroll="onScroll"
    >
      <div
        v-for="item in items"
        :key="item.value"
        class="wheel-column__item"
        :class="{ 'wheel-column__item--selected': item.value === modelValue }"
      >
        {{ item.label }}
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref, onMounted, watch, nextTick } from "vue";

const ITEM_HEIGHT = 40;

export default defineComponent({
  name: "WheelColumn",
  props: {
    items: {
      type: Array,
      default: () => [],
    },
    modelValue: {
      type: [String, Number],
      default: null,
    },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    const scrollRef = ref(null);
    let suppressScroll = false;

    function getIndex(value) {
      return props.items.findIndex((item) => item.value === value);
    }

    function scrollToIndex(index) {
      const el = scrollRef.value;
      if (!el || index < 0) return;
      suppressScroll = true;
      el.scrollTop = index * ITEM_HEIGHT;
      setTimeout(() => {
        suppressScroll = false;
      }, 150);
    }

    function onScroll() {
      if (suppressScroll) return;
      const el = scrollRef.value;
      if (!el) return;
      const index = Math.round(el.scrollTop / ITEM_HEIGHT);
      const item = props.items[index];
      if (item && item.value !== props.modelValue) {
        emit("update:modelValue", item.value);
      }
    }

    onMounted(() => {
      nextTick(() => {
        scrollToIndex(getIndex(props.modelValue));
      });
    });

    watch(
      () => props.modelValue,
      (value) => {
        const el = scrollRef.value;
        if (!el) return;
        const index = getIndex(value);
        if (index < 0) return;
        const currentIndex = Math.round(el.scrollTop / ITEM_HEIGHT);
        if (currentIndex !== index) {
          scrollToIndex(index);
        }
      }
    );

    return {
      scrollRef,
      onScroll,
    };
  },
});
</script>

<style scoped>
.wheel-column {
  position: relative;
  height: 120px;
  width: 100%;
  overflow: hidden;
}
.wheel-column__highlight {
  position: absolute;
  top: 40px;
  left: 0;
  right: 0;
  height: 40px;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  pointer-events: none;
}
body.body--dark .wheel-column__highlight {
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}
.wheel-column__scroll {
  height: 100%;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  padding: 40px 0;
  scrollbar-width: none;
}
.wheel-column__scroll::-webkit-scrollbar {
  display: none;
}
.wheel-column__item {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  scroll-snap-align: center;
  color: #9e9e9e;
  font-size: 16px;
  user-select: none;
}
body.body--dark .wheel-column__item {
  color: rgba(255, 255, 255, 0.5);
}
.wheel-column__item--selected {
  color: #000;
  font-weight: 600;
}
body.body--dark .wheel-column__item--selected {
  color: #fff;
}
</style>
