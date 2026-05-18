import { PrismaClient } from '@prisma/client';

const ROLES = ['boss_admin','senior_staff','kenya_intake_staff','australia_migration_team','read_only_reviewer'];
const prisma = new PrismaClient();

async function main() {
  for (const roleKey of ROLES) {
    await prisma.staffRole.upsert({ where: { key: roleKey }, update: {}, create: { key: roleKey, name: roleKey.replaceAll('_', ' '), isSystem: true } });
  }
  const email = process.env.SEED_BOSS_ADMIN_EMAIL?.toLowerCase();
  if (!email) return;
  const staff = await prisma.staffUser.upsert({ where: { email }, update: { isActive: true }, create: { authUserId: email, email, displayName: 'Initial Boss Admin', isActive: true } });
  const adminRole = await prisma.staffRole.findUniqueOrThrow({ where: { key: 'boss_admin' } });
  await prisma.staffUserRole.upsert({ where: { staffUserId_staffRoleId: { staffUserId: staff.id, staffRoleId: adminRole.id } }, update: { revokedAt: null }, create: { staffUserId: staff.id, staffRoleId: adminRole.id, assignedByStaffUserId: staff.id } });
}

main().finally(() => prisma.$disconnect());
