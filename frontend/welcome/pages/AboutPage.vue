<script setup lang="ts">
import { RouterLink } from "vue-router";
import EditorialLayout from "@/components/EditorialLayout.vue";
const beliefs = [
  {
    number: "01",
    english: "CHOOSE WITH INTENT",
    title: "从喜欢出发。",
    body: "从数码装备到日常好物，先了解，再选择。让每一次心动，都有自己的理由。",
  },
  {
    number: "02",
    english: "MEET AT THE MOMENT",
    title: "让期待准点发生。",
    body: "商品、场次与活动信息集中呈现。把想要的好物，放进一场有时间坐标的相遇。",
  },
  {
    number: "03",
    english: "KEEP IT CLEAR",
    title: "每一步，清楚可见。",
    body: "从参与抢购到确认订单，让结果有迹可循。少一点疑问，多一点从容。",
  },
];
</script>

<template>
  <EditorialLayout label="关于我们" index="01" english="THE PEAKRUSH WAY">
    <section class="pr-about-hero pr-wrap">
      <div class="pr-about-intro">
        <p class="pr-eyebrow">
          <span class="pr-orange-dot" /> A MOMENT WORTH WAITING FOR
        </p>
        <h1>为热爱，<br />留一席<span class="pr-orange">。</span></h1>
        <p class="pr-hero-description">
          好物不止是拥有。<br />也是发现它、期待它，与它准点相遇的那一刻。
        </p>
        <RouterLink class="pr-text-link" to="/community-board"
          >发现下一件心动好物 <span aria-hidden="true">↗</span></RouterLink
        >
        <div class="pr-about-signature">
          <span>CURATED GOODS.<br />TIMED ENCOUNTERS.</span
          ><span>PeakRush<br />好物准点开抢</span>
        </div>
      </div>
      <figure class="pr-about-art">
        <img
          src="/peakrush/editorial/brand-sculpture.png"
          alt="橙色光学玻璃与银色金属构成的巅峰雕塑"
          fetchpriority="high"
        />
        <figcaption>
          <span>THE ART OF ANTICIPATION</span
          ><span>PEAKRUSH / BRAND STUDY 01</span>
        </figcaption>
      </figure>
    </section>
    <section class="pr-manifesto pr-wrap">
      <div>
        <p class="pr-eyebrow">OUR POINT OF VIEW / 我们的主张</p>
        <h2 class="pr-section-title">
          日常的下一种可能，<br />从一件好物开始。
        </h2>
      </div>
      <div class="pr-manifesto-copy">
        <p>
          我们相信，让生活发生一点变化，不一定需要一个宏大的计划。一段好声音、一张新照片，或是一件陪你出发的装备，就足够。
        </p>
        <p>
          PeakRush
          把商品、限时场次与订单放在同一个入口。先发现值得期待的东西，再选择适合自己的时刻，清楚地完成每一步。
        </p>
        <RouterLink class="pr-text-link" to="/our-product"
          >了解如何参与 <span aria-hidden="true">↗</span></RouterLink
        >
      </div>
    </section>
    <section class="pr-beliefs pr-wrap" aria-label="品牌主张">
      <div v-for="belief in beliefs" :key="belief.number" class="pr-belief">
        <div class="pr-belief-meta">
          <span>{{ belief.number }}</span
          ><span>{{ belief.english }}</span>
        </div>
        <h3>{{ belief.title }}</h3>
        <p>{{ belief.body }}</p>
      </div>
    </section>
    <section class="pr-selection pr-wrap">
      <div class="pr-section-heading">
        <div>
          <p class="pr-eyebrow">OBJECTS OF DESIRE</p>
          <h2 class="pr-section-title">好物，让日常有回响。</h2>
        </div>
        <a class="pr-text-link" href="/app/"
          >浏览商城 <span aria-hidden="true">↗</span></a
        >
      </div>
      <div class="pr-selection-grid">
        <a href="/app/" class="pr-selection-item"
          ><img
            src="/peakrush/ads/earbuds.webp"
            alt="紫色声浪中的无线耳机"
            loading="lazy"
          />
          <div>
            <span>01 / SOUND</span>
            <h3>听见你的世界。</h3>
            <span aria-hidden="true">↗</span>
          </div></a
        ><a href="/app/" class="pr-selection-item"
          ><img
            src="/peakrush/ads/camera.webp"
            alt="雨夜城市里的便携相机"
            loading="lazy"
          />
          <div>
            <span>02 / FRAME</span>
            <h3>留住新的视角。</h3>
            <span aria-hidden="true">↗</span>
          </div></a
        ><a href="/app/" class="pr-selection-item"
          ><img
            src="/peakrush/ads/sneakers.webp"
            alt="充满动感的轻量运动鞋"
            loading="lazy"
          />
          <div>
            <span>03 / MOVE</span>
            <h3>向下一程出发。</h3>
            <span aria-hidden="true">↗</span>
          </div></a
        >
      </div>
      <p class="pr-caption">
        精选好物灵感展示。实际商品、活动价格与场次，请在商城查看。
      </p>
    </section>
  </EditorialLayout>
</template>
