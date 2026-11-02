<script setup lang="ts">
import { inject } from "vue";
import { RouterLink } from "vue-router";
import EditorialLayout from "@/components/EditorialLayout.vue";
import { PARTICIPATION_RULES } from "@/content/subpages/editorial";
import { EDITORIAL_SCROLL } from "@/app/editorialScroll";
const scrollTo = inject(EDITORIAL_SCROLL);
function jumpTo(id: string): void {
  const target = document.getElementById(`rule-${id}`);
  if (!target) return;
  if (scrollTo) scrollTo(target, -100);
  else target.scrollIntoView({ block: "start", behavior: "instant" });
}
</script>

<template>
  <EditorialLayout label="活动规则" index="04" english="PLAY IT CLEAR">
    <section class="pr-rules-hero pr-wrap">
      <div>
        <p class="pr-eyebrow">
          <span class="pr-orange-dot" /> A CLEAR WAY TO PARTICIPATE
        </p>
        <h1>尽兴开抢。<br />清楚每一步<span class="pr-orange">。</span></h1>
        <p class="pr-hero-description">
          好的体验，从明确的规则开始。<br />在参与之前，花一点时间，了解时间、库存与订单。
        </p>
        <RouterLink class="pr-text-link" to="/our-product"
          >第一次参与？先看指南 <span aria-hidden="true">↗</span></RouterLink
        >
      </div>
      <div class="pr-rules-summary">
        <p class="pr-eyebrow">THE ESSENTIALS / 参与要点</p>
        <div>
          <span>TIME</span>
          <h2>准点参与。</h2>
          <p>仅在活动有效时间内提交抢购。</p>
        </div>
        <div>
          <span>QUANTITY</span>
          <h2>认真确认。</h2>
          <p>同一账号、同场同商品，只能生成一笔订单。</p>
        </div>
        <div>
          <span>RESULT</span>
          <h2>以结果为准。</h2>
          <p>请求提交后，等待系统确认与订单生成。</p>
        </div>
        <span class="pr-rules-summary-mark" aria-hidden="true">↗</span>
      </div>
    </section>
    <section class="pr-rules-body pr-wrap">
      <aside class="pr-rule-index">
        <p class="pr-eyebrow">IN THIS GUIDE</p>
        <nav aria-label="规则目录">
          <button
            v-for="rule in PARTICIPATION_RULES"
            :key="rule.id"
            type="button"
            @click="jumpTo(rule.id)"
          >
            <span>{{ rule.number }}</span
            >{{
              rule.id === "account"
                ? "参与条件"
                : rule.id === "time"
                  ? "时间与库存"
                  : rule.id === "limit"
                    ? "限购与结果"
                    : "订单与支付"
            }}<span aria-hidden="true">↘</span>
          </button>
        </nav>
        <RouterLink class="pr-text-link" to="/terms-and-conditions"
          >平台使用规则 <span aria-hidden="true">↗</span></RouterLink
        >
      </aside>
      <div>
        <section
          v-for="rule in PARTICIPATION_RULES"
          :id="`rule-${rule.id}`"
          :key="rule.id"
          class="pr-rule-section"
        >
          <p class="pr-eyebrow">
            <span class="pr-orange">{{ rule.number }}</span> /
            {{ rule.english }}
          </p>
          <h2>{{ rule.title }}</h2>
          <p class="pr-rule-lead">{{ rule.lead }}</p>
          <div class="pr-rule-items">
            <div v-for="item in rule.items" :key="item.title">
              <h3>{{ item.title }}</h3>
              <p>{{ item.body }}</p>
            </div>
          </div>
        </section>
        <div class="pr-payment-note">
          <span class="pr-eyebrow">PLEASE NOTE / 支付说明</span>
          <p>这里的支付，是一次流程体验。</p>
          <span>模拟支付不会产生真实扣款，也不涉及实际物流发货。</span
          ><a class="pr-text-link" href="/app/orders"
            >查看我的订单 <span aria-hidden="true">↗</span></a
          >
        </div>
      </div>
    </section>
  </EditorialLayout>
</template>
