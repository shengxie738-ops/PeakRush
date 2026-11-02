<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import EditorialLayout from "@/components/EditorialLayout.vue";
import { GUIDE_STEPS } from "@/content/subpages/editorial";
const selected = ref(0);
const step = computed(() => GUIDE_STEPS[selected.value]!);
function selectWithKeyboard(event: KeyboardEvent, index: number): void {
  selected.value = index;
  (event.currentTarget as HTMLElement).parentElement
    ?.querySelectorAll<HTMLButtonElement>("button")
    [index]?.focus();
}
</script>

<template>
  <EditorialLayout label="抢购指南" index="02" english="YOUR FIRST DROP">
    <section class="pr-guide pr-wrap">
      <div class="pr-title-row">
        <div>
          <p class="pr-eyebrow">
            <span class="pr-orange-dot" /> A LITTLE PREPARATION. A BETTER
            MOMENT.
          </p>
          <h1>从心动，到订单<span class="pr-orange">。</span></h1>
        </div>
        <p class="pr-title-aside">
          第一次参加？<br />四个步骤，让每一次开抢更从容。
        </p>
      </div>
      <div class="pr-step-tabs" role="tablist" aria-label="抢购步骤">
        <button
          v-for="(item, index) in GUIDE_STEPS"
          :id="`guide-tab-${index}`"
          :key="item.number"
          type="button"
          role="tab"
          :aria-selected="selected === index"
          :tabindex="selected === index ? 0 : -1"
          aria-controls="guide-panel"
          :class="{ 'is-active': selected === index }"
          @click="selected = index"
          @keydown.right.prevent="
            selectWithKeyboard($event, (index + 1) % GUIDE_STEPS.length)
          "
          @keydown.left.prevent="
            selectWithKeyboard(
              $event,
              (index + GUIDE_STEPS.length - 1) % GUIDE_STEPS.length,
            )
          "
          @keydown.home.prevent="selectWithKeyboard($event, 0)"
          @keydown.end.prevent="
            selectWithKeyboard($event, GUIDE_STEPS.length - 1)
          "
        >
          <span class="pr-step-tab-number">{{ item.number }}</span
          ><span
            >{{ item.title }}<small>{{ item.english }}</small></span
          ><span aria-hidden="true">↗</span>
        </button>
      </div>
      <div
        id="guide-panel"
        class="pr-guide-panel"
        role="tabpanel"
        :aria-labelledby="`guide-tab-${selected}`"
        tabindex="0"
      >
        <div class="pr-guide-copy">
          <p class="pr-eyebrow">STEP {{ step.number }} / {{ step.english }}</p>
          <h2>{{ step.heading }}</h2>
          <p class="pr-guide-description">{{ step.description }}</p>
          <ul class="pr-checklist">
            <li v-for="item in step.checklist" :key="item">
              <span aria-hidden="true">✓</span>{{ item }}
            </li>
          </ul>
          <div class="pr-guide-panel-actions">
            <RouterLink
              v-if="!step.href.startsWith('/app/')"
              class="pr-button"
              :to="step.href"
              >{{ step.action }} <span aria-hidden="true">↗</span></RouterLink
            ><a v-else class="pr-button" :href="step.href"
              >{{ step.action }} <span aria-hidden="true">↗</span></a
            ><button
              v-if="selected < 3"
              class="pr-text-link"
              type="button"
              @click="selected += 1"
            >
              下一步 <span aria-hidden="true">→</span></button
            ><button
              v-else
              class="pr-text-link"
              type="button"
              @click="selected = 0"
            >
              再看一遍 <span aria-hidden="true">↺</span>
            </button>
          </div>
        </div>
        <figure class="pr-guide-art">
          <img :src="step.image" :alt="`${step.title}的橙色立体概念插画`" />
          <figcaption>
            <span>THE PROCESS / {{ step.number }}</span
            ><span>{{ step.title }}</span>
          </figcaption>
        </figure>
      </div>
    </section>
    <section class="pr-guide-notes pr-wrap">
      <div>
        <p class="pr-eyebrow">BEFORE YOU GO</p>
        <h2 class="pr-section-title">开抢前，记住这三件事。</h2>
      </div>
      <div class="pr-notes-grid">
        <div>
          <span>01 / TIME</span>
          <h3>留意场次。</h3>
          <p>活动时间、价格和限购数量，<br />以商城当前展示为准。</p>
        </div>
        <div>
          <span>02 / RESULT</span>
          <h3>等到确认。</h3>
          <p>提交不代表成功，<br />以返回结果与生成的订单为准。</p>
        </div>
        <div>
          <span>03 / ORDER</span>
          <h3>看清订单。</h3>
          <p>取消或超时后，<br />同一活动商品不能再次下单。</p>
        </div>
      </div>
      <RouterLink class="pr-text-link" to="/pricing"
        >阅读完整活动规则 <span aria-hidden="true">↗</span></RouterLink
      >
    </section>
  </EditorialLayout>
</template>
