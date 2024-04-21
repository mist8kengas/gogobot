import {
    type Interaction,
    SlashCommandBuilder,
    EmbedBuilder,
  } from "discord.js";
  import {Colors, type Command } from "../../../common/types";
import { guardEconomyChannel } from "!/common/logic/guildConfig/guardEconomyChannel";
import { stackOdds } from "./lib/stackOdds";
import { WorkType, coolDowns, workCommandUses } from "./lib/workConfig";
import { prisma } from "!/prisma";
import { sprintf } from "sprintf-js";
import { getRandomizedScenario } from "./lib/getRandomizedScenario";
import { createWallet } from "!/common/logic/economy/createWallet";
import { addCurrency } from "!/common/utils/addCurrency";
import { workTitle } from "./lib/workTitle";
import { formatNumber } from "!/common/utils/formatNumber";
import { randomNumber } from "!/common/utils/randomNumber";


enum Resources {
  Chopper = "CHOPPER", // 1k
  Silver = "SILVER", //10k
  Iron = "IRON", //50k
  Gold = "GOLD", // 100k
  Emerald = "EMERALD", // 500k
  Diamond = "DIAMOND", //1m
  RockSlide = "ROCK_FALL", //-10k
  DeadEnd = "DEAD_END", // 0
  Nothing = "NOTHING", // 0
  Ambused = "AMBUSED", // -100k
}

const odds: Record<Resources, number> = {
  [Resources.Chopper]: 100,
  [Resources.Silver]: 100,
  [Resources.Iron]: 30,
  [Resources.Gold]: 20,
  [Resources.Emerald]: 10,
  [Resources.Diamond]: 5,
  [Resources.RockSlide]: 30,
  [Resources.DeadEnd]: 30,
  [Resources.Nothing]: 30,
  [Resources.Ambused]: 10,
}

const computedOdds = stackOdds(odds);

const rewards: Record<Resources, {message: string, generateReward: () => Promise<number>}> = {
  [Resources.Chopper]: {
    message: 'You found Chopper. ⛏️',
    generateReward: async () => randomNumber(500, 1_000)
  },
  [Resources.Silver]: {
    message: 'You found Silver. ⛏️',
    generateReward: async () => randomNumber(5_000, 10_000)
  },
  [Resources.Iron]: {
    message: 'You found Iron. ⛏️',
    generateReward: async () => randomNumber(30_000, 50_000)
  },
  [Resources.Gold]: {
    message: 'You found Gold. ⛏️',
    generateReward: async () => randomNumber(75_000, 100_000)
  },
  [Resources.Emerald]: {
    message: 'You found Emerald. ⛏️',
    generateReward: async () => randomNumber(250_000, 500_000)
  },
  [Resources.Diamond]: {
    message: 'You found Diamind. 💎',
    generateReward: async () => randomNumber(1_000_0000, 1_950_000)
  },
  [Resources.RockSlide]: {
    message: 'You were caught on a rockslide and had to pay for injuries 🩹',
    generateReward: async () => -randomNumber(7_000, 10_000)
  },
  [Resources.DeadEnd]: {
    message: 'You reached a Dead End and had to return 🧱',
    generateReward: async () => 0
  },
  [Resources.Nothing]: {
    message: 'After hours of mining you found nothing 🚫',
    generateReward: async () => 0
  },
  [Resources.Ambused]: {
    message: 'While mining you were ambused but goblins 👽',
    generateReward: async () => -randomNumber(75_000, 100_000)
  },
}

  export const mine = {
    data: new SlashCommandBuilder()
      .setName("mine")
      .setDescription("Head to the mine to get some resources"),
    async execute(interaction: Interaction) {
      if (!interaction.isRepliable() || !interaction.isChatInputCommand()) {
        return;
      }

      const guildId = interaction.guild?.id;

      if(!guildId) {
        return await interaction.reply({
            content: "This command can only be used in a Server.",
            ephemeral: true
        })
      }

      const guard = await guardEconomyChannel(guildId, interaction.channelId, interaction.user.id);

      if (guard) {  
        return await interaction.reply({
          ephemeral: true,
          ...guard,
        });
      }

      const coolDown = coolDowns.MINE;

      const lastUses = await prisma.work.findMany({
        where: {
          type: WorkType.Mine,
          createdAt: {
            gte: new Date(Date.now() - coolDown),
          },
          userDiscordId: interaction.user.id
        },
        orderBy: {
          createdAt: "desc"
        },
        take: workCommandUses.MINE
      });

      if(lastUses.length >= workCommandUses.MINE) {
        const lastUse = lastUses.at(-1);

        if(!lastUse) {
          return await interaction.reply({
            content: "Hmm, something went wrong, Please try agian later."
          });
        }

        return await interaction.reply({
          content: sprintf("You are too tired to enter the mine, Visit again <t:%s:R>", Math.floor((lastUse.createdAt.getTime() + coolDown) / 1000))
        });
      }

      const randomizedResources = getRandomizedScenario(computedOdds);

      const { generateReward, message } = rewards[randomizedResources];
      const reward = await generateReward();
      const wallet = await createWallet(interaction.user.id, guildId);

      const userClan = await prisma.clan.findFirst({
        where: {

          members: {
            some: {
              discordUserId: interaction.user.id
            }
          },

          discordGuildId: guildId
        },

        select: {
          level: true
        }
      });

      const clanBonusMultiplier = reward < 0 ? 0 : userClan?.level ? userClan.level / 20 : 0;
      
      const clanBonus = Math.round(reward + clanBonusMultiplier);
      const totalReward = reward + clanBonus;

      await prisma.$transaction([
        prisma.work.create({
          data: {
            userDiscordId: interaction.user.id,
            guildDiscordId: guildId,
            type: WorkType.Mine
          }
        }),

        prisma.wallet.update({
          where: {
            id: wallet.id
          },

          data: {
            balance: {
              increment: totalReward
            }
          }

        }),
      ]);

      const makeDollars = addCurrency();

      const embed = new EmbedBuilder()
        .setColor(reward > 0 ? Colors.Success : Colors.Error)
        .setTitle(workTitle(totalReward))
        .setDescription(
          sprintf(
            "%s%s",
            message,
            clanBonusMultiplier > 0 && reward > 0
              ? sprintf(
                "Clan Bonus: **+%s** (%s)",
                makeDollars(formatNumber(clanBonus)),
                `${((clanBonusMultiplier + 1) * 100 - 100).toFixed(0)}`
              ) : ""
          )
        );

        if(lastUses.length === workCommandUses.MINE - 1) {
          const nextMine = sprintf(
            "Next Mine <t:%d:R>",
            Math.floor((Date.now() + coolDown) / 1000),
          );

          embed.setDescription(
            [embed.data.description, nextMine]
              .filter((v): v is string => v !=null)
              .join("\n")
          );
        } else {
          const count = workCommandUses.MINE - lastUses.length - 1;
          const word = count === 1 ? "use" : "uses";
          embed.setFooter({
            text: sprintf("%d %s left", count, word)
          });
        }

      return await interaction.reply({ embeds: [embed] });
    },
  } satisfies Command;
  