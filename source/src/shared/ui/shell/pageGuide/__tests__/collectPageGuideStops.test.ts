/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { collectPageGuideStops } from '../collectPageGuideStops';
import { PAGE_GUIDE_ATTR, PAGE_GUIDE_GROUP_ATTR, pageGuideProps } from '../pageGuide.attrs';
import { easePageGuideHop, samplePageGuideHop } from '../pageGuideTravel';
import { fitPageGuideHole, pageGuideClusterCoversHole, pointPageGuideAnchor, resolvePageGuideCenterCluster, resolvePageGuideCompanionPoint, resolvePageGuideSpeechCluster } from '../resolvePageGuidePlacement';
import { PAGE_GUIDE_BUBBLE_HEAD_GAP_PX, PAGE_GUIDE_COMPANION_HEIGHT_PX, PAGE_GUIDE_COMPANION_WIDTH_PX } from '../pageGuide.types';
import { resetPageGuideStoreForTests, startPageGuide, stopPageGuide, isPageGuideActive } from '../pageGuideStore';
import { PAGE_GUIDE_WONK_PEAK, PAGE_GUIDE_WONK_REST, stepPageGuideHoverWonk } from '../usePageGuideCompanionIdle';

const stubRect = (element: HTMLElement, width = 120, height = 40) => {
  element.getBoundingClientRect = () => ({
    x: 10,
    y: 10,
    width,
    height,
    top: 10,
    left: 10,
    right: 10 + width,
    bottom: 10 + height,
    toJSON: () => ({}),
  });
};

describe('pageGuideStore', () => {
  afterEach(() => {
    resetPageGuideStoreForTests();
  });

  it('starts and stops the page guide', () => {
    expect(isPageGuideActive()).toBe(false);
    startPageGuide({ x: 8, y: 8 });
    expect(isPageGuideActive()).toBe(true);
    stopPageGuide();
    expect(isPageGuideActive()).toBe(false);
  });
});

describe('pageGuideTravel', () => {
  it('arcs above the midpoint while hopping', () => {
    const from = { x: 0, y: 100 };
    const to = { x: 100, y: 100 };
    const start = samplePageGuideHop(from, to, 0);
    const end = samplePageGuideHop(from, to, 1);
    expect(start.x).toBeCloseTo(from.x, 8);
    expect(start.y).toBeCloseTo(from.y, 8);
    expect(end.x).toBeCloseTo(to.x, 8);
    expect(end.y).toBeCloseTo(to.y, 8);
    const mid = samplePageGuideHop(from, to, 0.45);
    expect(mid.y).toBeLessThan(100);
    expect(easePageGuideHop(0)).toBeCloseTo(0, 8);
    expect(easePageGuideHop(1)).toBeCloseTo(1, 8);
  });
});

describe('fitPageGuideHole', () => {
  it('crops a tall rail to a compact window and sits the companion beside its center', () => {
    const hole = fitPageGuideHole({ x: 0, y: 0, width: 250, height: 900 }, 1280, 800);
    expect(hole.height).toBeLessThan(300);
    expect(hole.width).toBeLessThanOrEqual(250);
    const companion = resolvePageGuideCompanionPoint(hole, 1280, 800, false);
    expect(companion.x).toBeGreaterThan(hole.x + hole.width);
    expect(companion.y).toBeGreaterThan(hole.y - 20);
    expect(companion.y).toBeLessThan(hole.y + hole.height);
  });
});

describe('stepPageGuideHoverWonk', () => {
  it('rises while the pointer moves over the companion and falls when it leaves', () => {
    const risen = stepPageGuideHoverWonk(PAGE_GUIDE_WONK_REST, true, 120, 0);
    expect(risen).toBeGreaterThan(PAGE_GUIDE_WONK_REST);
    expect(stepPageGuideHoverWonk(PAGE_GUIDE_WONK_PEAK, true, 80, 0)).toBe(PAGE_GUIDE_WONK_PEAK);
    expect(stepPageGuideHoverWonk(6, false, 0, 820)).toBeCloseTo(PAGE_GUIDE_WONK_REST, 5);
  });
});

describe('pointPageGuideAnchor', () => {
  it('collapses a wide header to a tiny center point', () => {
    const anchor = pointPageGuideAnchor({ x: 12, y: 12, width: 1250, height: 56 });
    expect(anchor.width).toBe(16);
    expect(anchor.height).toBe(16);
    expect(anchor.x).toBeCloseTo(12 + 1250 / 2 - 8, 5);
    expect(anchor.y).toBeCloseTo(12 + 56 / 2 - 8, 5);
  });
});

describe('resolvePageGuideSpeechCluster', () => {
  it('keeps the bubble above the companion head on a wide top header', () => {
    const hole = { x: 12, y: 12, width: 1250, height: 56 };
    const bubbleWidth = 288;
    const bubbleHeight = 148;
    const cluster = resolvePageGuideSpeechCluster(hole, bubbleWidth, bubbleHeight, 1280, 800, false);
    expect(cluster.companion.y).toBeGreaterThanOrEqual(
      cluster.bubble.y + bubbleHeight + PAGE_GUIDE_BUBBLE_HEAD_GAP_PX,
    );
    expect(cluster.bubble.y).toBeGreaterThanOrEqual(12);
    expect(cluster.companion.x + PAGE_GUIDE_COMPANION_WIDTH_PX / 2).toBeGreaterThan(cluster.bubble.x);
    expect(cluster.companion.x + PAGE_GUIDE_COMPANION_WIDTH_PX / 2).toBeLessThan(cluster.bubble.x + bubbleWidth);
  });

  it('parks the bubble and companion clear of a tiny top-toolbar hotspot', () => {
    const hole = pointPageGuideAnchor({ x: 96, y: 8, width: 36, height: 36 });
    const bubbleWidth = 288;
    const bubbleHeight = 148;
    const cluster = resolvePageGuideSpeechCluster(hole, bubbleWidth, bubbleHeight, 1280, 800, false);
    expect(cluster.companion.y).toBeGreaterThanOrEqual(
      cluster.bubble.y + bubbleHeight + PAGE_GUIDE_BUBBLE_HEAD_GAP_PX,
    );
    expect(pageGuideClusterCoversHole(cluster, hole, bubbleWidth, bubbleHeight)).toBe(false);
    expect(cluster.bubble.y).toBeGreaterThanOrEqual(hole.y + hole.height);
  });
});

describe('resolvePageGuideCenterCluster', () => {
  it('stacks the bubble above the companion in the middle of the viewport', () => {
    const bubbleWidth = 352;
    const bubbleHeight = 280;
    const cluster = resolvePageGuideCenterCluster(bubbleWidth, bubbleHeight, 1280, 800);
    expect(cluster.companion.x + PAGE_GUIDE_COMPANION_WIDTH_PX / 2).toBeCloseTo(640, 0);
    expect(cluster.companion.y).toBeGreaterThanOrEqual(
      cluster.bubble.y + bubbleHeight + PAGE_GUIDE_BUBBLE_HEAD_GAP_PX,
    );
    expect(cluster.companion.y + PAGE_GUIDE_COMPANION_HEIGHT_PX).toBeLessThanOrEqual(800 - 12);
    expect(cluster.bubble.x).toBeGreaterThanOrEqual(12);
    expect(cluster.bubble.x + bubbleWidth).toBeLessThanOrEqual(1280 - 12);
  });
});

describe('collectPageGuideStops', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('orders stops from most important to least important and dedupes a field surface', () => {
    const header = document.createElement('header');
    Object.assign(header, {});
    Object.entries(pageGuideProps({
      title: 'Page header',
      hint: 'Shows where you are.',
      priority: 10,
      scope: 'chrome',
    })).forEach(([key, value]) => header.setAttribute(key, value));
    stubRect(header, 800, 56);

    const field = document.createElement('div');
    Object.entries(pageGuideProps({
      title: 'Name',
      hint: 'Canonical display name.',
      priority: 50,
      surface: true,
    })).forEach(([key, value]) => field.setAttribute(key, value));
    stubRect(field, 240, 64);

    const icon = document.createElement('button');
    Object.entries(pageGuideProps({
      title: 'Name',
      hint: 'Canonical display name.',
      priority: 55,
    })).forEach(([key, value]) => icon.setAttribute(key, value));
    stubRect(icon, 16, 16);
    field.append(icon);

    const sidebar = document.createElement('aside');
    Object.entries(pageGuideProps({
      title: 'Navigation',
      hint: 'Studio pages live in this rail.',
      priority: 70,
      scope: 'chrome',
    })).forEach(([key, value]) => sidebar.setAttribute(key, value));
    stubRect(sidebar, 220, 600);

    document.body.append(header, field, sidebar);

    const stops = collectPageGuideStops(document);
    expect(stops.map((stop) => stop.title)).toEqual(['Page header', 'Name']);
    expect(stops[1]?.element).toBe(field);
    expect(document.querySelectorAll(`[${PAGE_GUIDE_ATTR}]`).length).toBe(4);
  });

  it('walks stops in document order and drops duplicate titles', () => {
    const headerSearch = document.createElement('button');
    Object.entries(pageGuideProps({
      title: 'Search',
      hint: 'Filters the list.',
      priority: 12,
      scope: 'chrome',
    })).forEach(([key, value]) => headerSearch.setAttribute(key, value));
    stubRect(headerSearch, 36, 36);

    const sidebarSearch = document.createElement('button');
    Object.entries(pageGuideProps({
      title: 'Search',
      hint: 'Filters the list.',
      priority: 30,
      scope: 'chrome',
    })).forEach(([key, value]) => sidebarSearch.setAttribute(key, value));
    stubRect(sidebarSearch, 36, 36);

    const field = document.createElement('div');
    Object.entries(pageGuideProps({
      title: 'Title',
      hint: 'Required. Enter title.',
      priority: 50,
    })).forEach(([key, value]) => field.setAttribute(key, value));
    stubRect(field, 240, 40);

    const account = document.createElement('button');
    Object.entries(pageGuideProps({
      title: 'Account',
      hint: 'Opens your profile.',
      priority: 16,
      scope: 'chrome',
    })).forEach(([key, value]) => account.setAttribute(key, value));
    stubRect(account, 36, 36);

    document.body.append(headerSearch, sidebarSearch, field, account);

    const stops = collectPageGuideStops(document);
    expect(stops.map((stop) => stop.title)).toEqual(['Search', 'Title', 'Account']);
    expect(stops[0]?.element).toBe(headerSearch);
  });

  it('walks page toolbar stops before shell chrome', () => {
    const create = document.createElement('button');
    Object.entries(pageGuideProps({
      title: 'Create',
      hint: 'Opens a form to add a new item.',
      priority: 16,
    })).forEach(([key, value]) => create.setAttribute(key, value));
    stubRect(create, 88, 32);

    const account = document.createElement('button');
    Object.entries(pageGuideProps({
      title: 'Account',
      hint: 'Opens your profile.',
      priority: 16,
      scope: 'chrome',
    })).forEach(([key, value]) => account.setAttribute(key, value));
    stubRect(account, 36, 36);

    document.body.append(create, account);

    expect(collectPageGuideStops(document).map((stop) => stop.title)).toEqual(['Create', 'Account']);
  });

  it('skips nodes whose layout box cannot be read', () => {
    const broken = document.createElement('button');
    Object.entries(pageGuideProps({
      title: 'Broken',
      hint: 'This control throws while measuring.',
      priority: 10,
    })).forEach(([key, value]) => broken.setAttribute(key, value));
    broken.getBoundingClientRect = () => {
      throw new Error('layout box unavailable');
    };
    const ok = document.createElement('button');
    Object.entries(pageGuideProps({
      title: 'Refresh',
      hint: 'Reloads this list.',
      priority: 20,
    })).forEach(([key, value]) => ok.setAttribute(key, value));
    stubRect(ok, 36, 36);
    document.body.append(broken, ok);

    expect(collectPageGuideStops(document).map((stop) => stop.title)).toEqual(['Refresh']);
  });

  it('tags stops as this page, navigation, or capabilities', () => {
    const field = document.createElement('div');
    Object.entries(pageGuideProps({
      title: 'Name',
      hint: 'Canonical display name.',
      priority: 50,
      topic: 'page',
    })).forEach(([key, value]) => field.setAttribute(key, value));
    stubRect(field, 240, 40);

    const nav = document.createElement('button');
    Object.entries(pageGuideProps({
      title: 'Data Studio',
      hint: 'Design models and query live data.',
      priority: 86,
      scope: 'chrome',
      topic: 'navigation',
    })).forEach(([key, value]) => nav.setAttribute(key, value));
    stubRect(nav, 36, 36);

    const account = document.createElement('button');
    Object.entries(pageGuideProps({
      title: 'Account',
      hint: 'Opens your profile.',
      priority: 16,
      scope: 'chrome',
      topic: 'capabilities',
    })).forEach(([key, value]) => account.setAttribute(key, value));
    stubRect(account, 36, 36);

    document.body.append(field, nav, account);
    const stops = collectPageGuideStops(document);
    expect(stops.map((stop) => `${stop.title}:${stop.topic}`)).toEqual([
      'Name:page',
      'Data Studio:navigation',
      'Account:capabilities',
    ]);
  });
});
