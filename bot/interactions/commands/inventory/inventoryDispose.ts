import { wrongGuildForInteraction } from "!/bot/logic/responses/wrongGuildForInteraction";
import {
  InteractionType,
  type AnyInteraction,
  type InteractionContext,
} from "!/bot/types";
import { z } from "zod";
import { createEmbed, inventoryDisposeMenuContext } from "./inventory";
import { prisma } from "!/core/db/prisma";
import { toolIds, type ToolTypes } from "../economy/lib/shopConfig";
import { buyToolItems } from "../economy/lib/shopItems";
import { sprintf } from "sprintf-js";
import { ActionRowBuilder } from "@discordjs/builders";
import { ButtonBuilder, ButtonStyle } from "discord.js";
import { notYourInteraction } from "!/bot/logic/responses/notYourInteraction";

const disposeContext = z.object({
  walletId: z.string(),
  toolUniqueId: z.string(),
});

export async function inventoryToolDispose(
  interactionContext: InteractionContext,
  interaction: AnyInteraction,
) {
  if (!interaction.isStringSelectMenu()) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "This interaction is only available as string menu select.",
    }));
  }

  const context = inventoryDisposeMenuContext.safeParse(
    JSON.parse(interactionContext.payload ?? "{}"),
  );

  if (!context.success) {
    return await interaction.reply({
      content: "Invalid interaction context",
      ephemeral: true,
    });
  }

  if (interaction.user.id !== interactionContext.userDiscordId) {
    return await interaction.reply(
      notYourInteraction(interactionContext, interaction),
    );
  }

  const guildId = interaction.guildId;

  if (!guildId) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "This command is only available in servers.",
    }));
  }

  if (guildId !== interactionContext.guildId) {
    return await interaction.reply(
      wrongGuildForInteraction(interactionContext, interaction),
    );
  }

  const toolUniqueId = z.string().safeParse(interaction.values[0]);

  if (!toolUniqueId.success) {
    return await interaction.reply({
      content: "Invalid value",
      ephemeral: true,
    });
  }

  const selectedTool = await prisma.shopItem.findUnique({
    where: {
      id: toolUniqueId.data,
    },
  });

  if (!selectedTool) {
    return await interaction.reply({
      content: "Cannot find selected tool. Contact Developer.",
      ephemeral: true,
    });
  }

  const ToolType = (Object.keys(toolIds) as Array<ToolTypes>).find(
    (key) => toolIds[key] === selectedTool.itemId,
  ) as ToolTypes;
  const toolData = buyToolItems[ToolType];

  const [disposeInteractionAccept, disposeInteractionDecline] =
    await prisma.$transaction([
      prisma.interaction.create({
        data: {
          type: InteractionType.InventoryDisposeToolAccept,
          userDiscordId: interaction.user.id,
          guildId,
          payload: JSON.stringify({
            walletId: context.data.walletId,
            toolUniqueId: selectedTool.id,
          } satisfies z.infer<typeof disposeContext>),
        },
      }),
      prisma.interaction.create({
        data: {
          type: InteractionType.InventoryDisposeToolDecline,
          userDiscordId: interaction.user.id,
          guildId,
          payload: JSON.stringify({
            walletId: context.data.walletId,
            toolUniqueId: selectedTool.id,
          } satisfies z.infer<typeof disposeContext>),
        },
      }),
    ]);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(disposeInteractionAccept.id)
      .setLabel("Accept")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(disposeInteractionDecline.id)
      .setLabel("Decline")
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.update({
    content: sprintf(
      "Are you sure, You want to dispose %s|%s",
      toolData.emoji,
      toolData.name,
    ),
    embeds: [],
    components: [row],
  });
}

export async function inventoryToolDisposeAccept(
  interactionContext: InteractionContext,
  interaction: AnyInteraction,
) {
  if (!interaction.isButton()) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "This interaction is an button",
    }));
  }

  const context = disposeContext.safeParse(
    JSON.parse(interactionContext.payload ?? "{}"),
  );

  if (!context.success) {
    return await interaction.reply({
      content: "Invalid interaction context",
      ephemeral: true,
    });
  }

  if (interaction.user.id !== interactionContext.userDiscordId) {
    return await interaction.reply(
      notYourInteraction(interactionContext, interaction),
    );
  }

  const guild = interaction.guild;

  if (!guild) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "This command is only available in servers.",
    }));
  }

  if (guild.id !== interactionContext.guildId) {
    return await interaction.reply(
      wrongGuildForInteraction(interactionContext, interaction),
    );
  }

  const toolUniqueId = z.string().safeParse(context.data.toolUniqueId);

  if (!toolUniqueId.success) {
    return await interaction.reply({
      content: "Invalid value",
      ephemeral: true,
    });
  }

  const selectedTool = await prisma.shopItem.findUnique({
    where: {
      id: toolUniqueId.data,
    },
  });

  if (!selectedTool) {
    return await interaction.reply({
      content: "Cannot find selected tool. Contact Developer.",
      ephemeral: true,
    });
  }

  const ToolType = (Object.keys(toolIds) as Array<ToolTypes>).find(
    (key) => toolIds[key] === selectedTool.itemId,
  ) as ToolTypes;
  const toolData = buyToolItems[ToolType];

  await prisma.shopItem.delete({
    where: {
      id: selectedTool.id,
    },
  });

  await interaction.update(
    await createEmbed(
      interaction.user,
      interaction.guild,
      sprintf(
        "Sucessfully disposed %s|%s from you inventory.",
        toolData.emoji,
        toolData.name,
      ),
    ),
  );
}

export async function inventoryToolDisposeDecline(
  interactionContext: InteractionContext,
  interaction: AnyInteraction,
) {
  if (!interaction.isButton()) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "This interaction is an button",
    }));
  }

  const context = disposeContext.safeParse(
    JSON.parse(interactionContext.payload ?? "{}"),
  );

  if (!context.success) {
    return await interaction.reply({
      content: "Invalid interaction context",
      ephemeral: true,
    });
  }

  if (interaction.user.id !== interactionContext.userDiscordId) {
    return await interaction.reply(
      notYourInteraction(interactionContext, interaction),
    );
  }

  const guild = interaction.guild;

  if (!guild) {
    return void (await interaction.reply({
      ephemeral: true,
      content: "This command is only available in servers.",
    }));
  }

  if (guild.id !== interactionContext.guildId) {
    return await interaction.reply(
      wrongGuildForInteraction(interactionContext, interaction),
    );
  }

  await interaction.update(
    await createEmbed(interaction.user, interaction.guild),
  );
}
