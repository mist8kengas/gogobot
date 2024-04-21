import { Colors } from "!/common/types";
import { prisma } from "!/prisma";
import { upsertClanChannel } from "./clanChannel";
import { clanNotification } from "./clanNotification";

export async function clanSendNotificationOrMessage(
  clanId: string,
  content: string,
) {
  const clan = await prisma.clan.findUnique({
    where: {
      id: clanId,
    },
  });
  const channel = clan ? await upsertClanChannel(clan.id) : null;

  if (channel && clan) {
    const { ok } = await clanNotification(clan.id, content, Colors.Success);

    if (ok) {
      return {
        ephemeral: true,
        content,
      };
    }
  }

  return {
    content,
  };
}