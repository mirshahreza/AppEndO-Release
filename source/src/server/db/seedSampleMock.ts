import { prisma } from '../domain/users/prismaHelpers';
import { sampleMockPhotoSrc } from '../../shared/api/contracts/sample-mock/records';
import { seedSampleMockRecordEvents } from '../domain/record-events/sampleMockHistory';

const PEOPLE = [
  { username: 'admin', displayName: 'Admin', email: 'admin@example.com' },
  { username: 'nina.vale', displayName: 'Nina Vale', email: 'nina.vale@example.com' },
  { username: 'sam.rivera', displayName: 'Sam Rivera', email: 'sam.rivera@example.com' },
  { username: 'jordan.lee', displayName: 'Jordan Lee', email: 'jordan.lee@example.com' },
] as const;

const STATUSES = [
  { code: 'open', title: 'Open', sortOrder: 1 },
  { code: 'approved', title: 'Approved', sortOrder: 2 },
  { code: 'shipped', title: 'Shipped', sortOrder: 3 },
] as const;

const TAGS = [
  { slug: 'urgent', title: 'Urgent' },
  { slug: 'billing', title: 'Billing' },
  { slug: 'north', title: 'North' },
  { slug: 'west', title: 'West' },
  { slug: 'vip', title: 'VIP' },
  { slug: 'archive', title: 'Archive' },
] as const;

const CITIES = ['North Harbor', 'West Ridge', 'East Bay', 'South Dock'] as const;
const CITY_COORDS: Record<(typeof CITIES)[number], { lat: number; lng: number }> = {
  'North Harbor': { lat: 35.6892, lng: 51.389 },
  'West Ridge': { lat: 41.0082, lng: 28.9784 },
  'East Bay': { lat: 25.2048, lng: 55.2708 },
  'South Dock': { lat: 30.0444, lng: 31.2357 },
};

const coordsForIndex = (index: number): { latitude: number; longitude: number } => {
  const city = CITIES[index % CITIES.length];
  const origin = CITY_COORDS[city];
  return {
    latitude: Number((origin.lat + ((index % 9) - 4) * 0.04).toFixed(5)),
    longitude: Number((origin.lng + ((index % 7) - 3) * 0.04).toFixed(5)),
  };
};
const COMMENT_BODIES = ['Need follow-up', 'Ready to ship', 'Customer called'] as const;
const STATUS_TITLES = ['Open', 'Approved', 'Shipped'] as const;

const seedIso = (day: number, hour: number): Date => (
  new Date(`2026-03-${String(((day - 1) % 28) + 1).padStart(2, '0')}T${String(hour).padStart(2, '0')}:30:00.000Z`)
);

const REGION_COUNT = 3;
const ORDER_COUNT = 80;

export async function seedSampleMockCatalog(): Promise<void> {
  const db = prisma();

  for (const status of STATUSES) {
    await db.baseSampleMockStatus.upsert({
      where: { code: status.code },
      create: status,
      update: { title: status.title, sortOrder: status.sortOrder },
    });
  }

  for (const person of PEOPLE) {
    await db.baseSampleMockPerson.upsert({
      where: { username: person.username },
      create: person,
      update: { displayName: person.displayName, email: person.email },
    });
  }

  for (const tag of TAGS) {
    await db.baseSampleMockTag.upsert({
      where: { slug: tag.slug },
      create: tag,
      update: { title: tag.title },
    });
  }

  const statuses = await db.baseSampleMockStatus.findMany();
  const people = await db.baseSampleMockPerson.findMany({ orderBy: { username: 'asc' } });
  const tags = await db.baseSampleMockTag.findMany();
  const statusByTitle = new Map(statuses.map((row) => [row.title, row]));
  const personByIndex = (index: number) => people[index % people.length]!;
  const admin = people.find((row) => row.username === 'admin') ?? people[0];

  const regionIds: bigint[] = [];
  for (let region = 1; region <= REGION_COUNT; region += 1) {
    const code = `REG-${region}`;
    const createdAt = seedIso(region, 8);
    const row = await db.baseSampleMockRecord.upsert({
      where: { code },
      create: {
        code,
        title: `Region ${region}`,
        subtitle: `Territory ${region}`,
        website: `https://example.com/regions/${region}`,
        photo: sampleMockPhotoSrc(region),
        statusId: statusByTitle.get('Open')!.id,
        ownerId: personByIndex(region).id,
        sortOrder: region,
        locked: false,
        active: true,
        ...coordsForIndex(region),
        createdAt,
        createdBy: admin?.id,
        updatedAt: createdAt,
        updatedBy: admin?.id,
      },
      update: {
        title: `Region ${region}`,
        subtitle: `Territory ${region}`,
        photo: sampleMockPhotoSrc(region),
        parentId: null,
        sortOrder: region,
        ...coordsForIndex(region),
      },
    });
    regionIds.push(row.id);
  }

  for (let index = 0; index < ORDER_COUNT; index += 1) {
    const n = index + 1;
    const code = `ORD-${String(n).padStart(3, '0')}`;
    const statusTitle = STATUS_TITLES[index % STATUS_TITLES.length];
    const locked = index % 7 === 0;
    const createdBy = personByIndex(index);
    const updatedBy = personByIndex(index + 3);
    const createdAt = seedIso(n, 9);
    const patched = locked || statusTitle !== 'Open' || index % 2 === 1;
    const updatedAt = patched ? seedIso(n + 2, 16) : createdAt;
    const approved = statusTitle === 'Approved' || statusTitle === 'Shipped';
    const parentId = regionIds[index % REGION_COUNT];

    const record = await db.baseSampleMockRecord.upsert({
      where: { code },
      create: {
        code,
        title: `Order ${n}`,
        subtitle: `Customer ${n}`,
        website: `https://example.com/orders/${code.toLowerCase()}`,
        photo: sampleMockPhotoSrc(n + REGION_COUNT),
        parentId,
        statusId: statusByTitle.get(statusTitle)!.id,
        ownerId: personByIndex(index + 1).id,
        sortOrder: 100 + n,
        locked,
        active: index % 3 !== 0,
        ...coordsForIndex(n),
        approvedAt: approved ? updatedAt : null,
        approvedBy: approved ? updatedBy.id : null,
        lockedAt: locked ? updatedAt : null,
        lockedBy: locked ? updatedBy.id : null,
        createdAt,
        createdBy: createdBy.id,
        updatedAt,
        updatedBy: (patched ? updatedBy : createdBy).id,
      },
      update: {
        title: `Order ${n}`,
        subtitle: `Customer ${n}`,
        parentId,
        statusId: statusByTitle.get(statusTitle)!.id,
        ownerId: personByIndex(index + 1).id,
        sortOrder: 100 + n,
        locked,
        active: index % 3 !== 0,
        photo: sampleMockPhotoSrc(n + REGION_COUNT),
        ...coordsForIndex(n),
      },
    });

    await db.baseSampleMockDetail.upsert({
      where: { recordId: record.id },
      create: {
        recordId: record.id,
        city: CITIES[index % CITIES.length],
        note: `Fulfill from ${CITIES[index % CITIES.length]}`,
        createdBy: createdBy.id,
        updatedBy: createdBy.id,
      },
      update: {
        city: CITIES[index % CITIES.length],
        note: `Fulfill from ${CITIES[index % CITIES.length]}`,
      },
    });

    const existingComments = await db.baseSampleMockComment.count({ where: { recordId: record.id } });
    if (existingComments === 0) {
      const commentCount = index % 3;
      for (let commentIndex = 0; commentIndex < commentCount; commentIndex += 1) {
        await db.baseSampleMockComment.create({
          data: {
            recordId: record.id,
            authorId: personByIndex(index + commentIndex).id,
            body: COMMENT_BODIES[commentIndex % COMMENT_BODIES.length],
            createdBy: personByIndex(index + commentIndex).id,
          },
        });
      }
    }

    const existingTags = await db.baseSampleMockRecordTag.count({ where: { recordId: record.id } });
    if (existingTags === 0 && tags.length > 0) {
      const tagCount = (index % 3) + 1;
      const chosen = new Set<bigint>();
      for (let tagIndex = 0; tagIndex < tagCount; tagIndex += 1) {
        chosen.add(tags[(index + tagIndex) % tags.length]!.id);
      }
      for (const tagId of chosen) {
        await db.baseSampleMockRecordTag.create({
          data: { recordId: record.id, tagId },
        });
      }
    }
  }

  for (let region = 1; region <= REGION_COUNT; region += 1) {
    const regionRow = await db.baseSampleMockRecord.findUnique({ where: { code: `REG-${region}` } });
    if (!regionRow) continue;
    await db.baseSampleMockDetail.upsert({
      where: { recordId: regionRow.id },
      create: {
        recordId: regionRow.id,
        city: CITIES[(region - 1) % CITIES.length],
        note: `Region hub`,
      },
      update: { city: CITIES[(region - 1) % CITIES.length] },
    });
  }

  await seedSampleMockRecordEvents();
}
