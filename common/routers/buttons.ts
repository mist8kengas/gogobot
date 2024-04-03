import type { ButtonInteraction, CacheType } from "discord.js";
import { leaderBoardChangePage } from "../../interactions/buttons/leaderBoardChangePage";
import { showSubscribeModal } from "../../interactions/buttons/showSubscribeModal";
import { subscribe } from "../../interactions/buttons/subscribe";
import { subscriptionListChangePage } from "../../interactions/buttons/subscriptionListChangePage";
import { unsubscribe } from "../../interactions/buttons/unsubscribe";
import { ButtonAction } from "../types";

/** @deprecated */
export async function buttonRouter(interaction: ButtonInteraction<CacheType>) {
  const [action, data] = interaction.customId.split("+");

  if (!action || !data) {
    await interaction.reply({
      content: "Invalid button action",
      ephemeral: true,
    });
    return;
  }

  switch (action) {
    case ButtonAction.Subscribe:
      return await subscribe(interaction, data);
    case ButtonAction.Unsubscribe:
      return await unsubscribe(interaction, data);
    case ButtonAction.ShowSubscribeModal:
      return await showSubscribeModal(interaction);
    case ButtonAction.SubscriptionListChangePage:
      return await subscriptionListChangePage(interaction, data);
    case ButtonAction.LeaderBoardChangePage:
      return await leaderBoardChangePage(interaction, data);
  }
}
