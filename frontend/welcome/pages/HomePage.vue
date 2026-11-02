<script setup lang="ts">
/**
 * HomePage — the 8 measured sections of docs/DOM_CONTRACT.md, in reference order.
 * Heights at 1376x772: 1544, 1544, 2123, 1544, 1544, 1544, 2316, 808 (total 7563).
 */
import HomeHero from '@/features/home/HomeHero.vue';
import HomeGetSeen from '@/features/home/HomeGetSeen.vue';
import HomeCard from '@/features/home/HomeCard.vue';
import HomeCentralize from '@/features/home/HomeCentralize.vue';
import HomeAudience from '@/features/home/HomeAudience.vue';
import HomeTestimonials from '@/features/home/HomeTestimonials.vue';
import HomeConnectory from '@/features/home/HomeConnectory.vue';
import HomeJoinUs from '@/features/home/HomeJoinUs.vue';
</script>

<template>
    <HomeHero />
    <HomeGetSeen />
    <HomeCard />
    <HomeCentralize />
    <HomeAudience />
    <HomeTestimonials />
    <HomeConnectory />
    <HomeJoinUs />
</template>
