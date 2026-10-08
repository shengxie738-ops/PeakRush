<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import EditorialLayout from "@/components/EditorialLayout.vue";
import RichText from "./RichText.vue";
import { FAQ_GROUPS, faqQuestionCount } from "@/content/subpages/faq";
const selected = ref(FAQ_GROUPS[0]!.title);
const query = ref("");
const opened = ref(new Set(["account-getting-started-0"]));
const allQuestions = FAQ_GROUPS.flatMap((group) =>
  group.subGroups.flatMap((sub) =>
    sub.questions.map((item, index) => ({
      ...item,
      id: `${sub.regionId}-${index}`,
      group: group.title,
      label: sub.label,
    })),
  ),
);
const questions = computed(() => {
  const search = query.value.trim().toLowerCase();
  return allQuestions.filter((item) =>
    search
      ? [item.question, ...item.answer, item.group, item.label]
          .join(" ")
          .toLowerCase()
          .includes(search)
      : item.group === selected.value,
  );
});
function toggle(id: string): void {
  const next = new Set(opened.value);
  next.has(id) ? next.delete(id) : next.add(id);
  opened.value = next;
}
function chooseCategory(title: string): void {
  selected.value = title;
  query.value = "";
}
</script>

<template>
  <EditorialLayout label="常见问题" index="05" english="A LITTLE CLARITY">
    <section class="pr-faq-hero pr-wrap">
      <div>
        <p class="pr-eyebrow">
          <span class="pr-orange-dot" /> YOUR QUESTIONS. OUR ANSWERS.
        </p>
        <h1>疑问到此。<br />热爱继续<span class="pr-orange">。</span></h1>
      </div>
      <div class="pr-faq-search-block">
        <p>从第一次登录，到订单确认。<br />你关心的问题，在这里找到答案。</p>
        <label class="pr-search"
          ><svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10" cy="10" r="6.5" />
            <path d="m15 15 5 5" /></svg
          ><input
            v-model="query"
            type="search"
            placeholder="搜索你的问题，例如：支付、库存"
            aria-label="搜索常见问题" /></label
        ><span class="pr-caption"
          >{{ faqQuestionCount() }} 个答案，帮助你从容参与。</span
        >
      </div>
    </section>
    <section class="pr-faq-body pr-wrap">
      <aside class="pr-faq-sidebar">
        <p class="pr-eyebrow">EXPLORE BY TOPIC / 问题分类</p>
        <nav aria-label="问题分类">
          <button
            v-for="(group, index) in FAQ_GROUPS"
            :key="group.title"
            type="button"
            :aria-pressed="!query.trim() && selected === group.title"
            :class="{ 'is-active': !query.trim() && selected === group.title }"
            @click="chooseCategory(group.title)"
          >
            <span>0{{ index + 1 }}</span
            >{{ group.title
            }}<span>{{
              allQuestions
                .filter((item) => item.group === group.title)
                .length.toString()
                .padStart(2, "0")
            }}</span>
          </button>
        </nav>
        <div class="pr-faq-help">
          <span class="pr-orange">↗</span>
          <h3>想了解完整流程？</h3>
          <p>从准备到开抢，<br />四个步骤带你熟悉 PeakRush。</p>
          <RouterLink class="pr-text-link" to="/our-product"
            >阅读抢购指南 <span aria-hidden="true">↗</span></RouterLink
          >
        </div>
      </aside>
      <div class="pr-faq-answers">
        <div class="pr-faq-category-title">
          <h2>{{ query.trim() ? "搜索结果" : selected }}</h2>
          <span role="status"
            >{{ questions.length.toString().padStart(2, "0") }} 个问题</span
          >
        </div>
        <section
          v-for="(item, index) in questions"
          :key="item.id"
          class="pr-faq-item"
          :class="{ 'is-open': opened.has(item.id) }"
        >
          <h3>
            <button
              :id="`question-${item.id}`"
              type="button"
              :aria-expanded="opened.has(item.id)"
              :aria-controls="`answer-${item.id}`"
              data-testid="faq-toggle"
              @click="toggle(item.id)"
            >
              <span class="pr-faq-question-number">{{
                (index + 1).toString().padStart(2, "0")
              }}</span
              ><span>{{ item.question }}</span
              ><span class="pr-faq-plus" aria-hidden="true">{{
                opened.has(item.id) ? "−" : "+"
              }}</span>
            </button>
          </h3>
          <div
            v-show="opened.has(item.id)"
            :id="`answer-${item.id}`"
            role="region"
            :aria-labelledby="`question-${item.id}`"
            class="pr-faq-answer"
          >
            <span class="pr-eyebrow">{{ item.label }}</span
            ><RichText :blocks="item.answer" />
          </div>
        </section>
        <div v-if="!questions.length" class="pr-empty" role="status">
          <p>没有找到相关答案，试试更短的关键词。</p>
          <button class="pr-text-link" type="button" @click="query = ''">
            返回问题分类 <span aria-hidden="true">↗</span>
          </button>
        </div>
        <div class="pr-faq-bottom-note">
          <span>参与前看清规则，让每次开抢更从容。</span
          ><RouterLink class="pr-text-link" to="/pricing"
            >查看活动规则 <span aria-hidden="true">↗</span></RouterLink
          >
        </div>
      </div>
    </section>
  </EditorialLayout>
</template>
