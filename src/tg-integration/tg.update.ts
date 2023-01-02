import { Ctx, Hears, On, Sender, Start, Update } from 'nestjs-telegraf'
import { ProjectService } from 'src/project/project.service'
import { SWETRIX_SETTINGS_URL } from 'src/tg-integration/constants'
import { UserService } from 'src/user/user.service'
import { Context } from 'telegraf'
import * as dayjs from 'dayjs'
import * as utc from 'dayjs/plugin/utc'
import * as timezone from 'dayjs/plugin/timezone'
import { AnalyticsService } from 'src/analytics/analytics.service'
import { getPIDsArray } from 'src/analytics/analytics.controller'

dayjs.extend(utc)
dayjs.extend(timezone)

@Update()
export class SwetrixUpdate {
  constructor(
    private readonly userService: UserService,
    private readonly projectService: ProjectService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Start()
  async start(
    @Ctx() ctx: Context,
    @Sender('first_name') firstName: string,
    @Sender('id') chatId: string,
  ): Promise<void> {
    const user = await this.userService.findOneWhere({ telegramChatId: chatId })
    const text =
      `Hello, *${firstName}*!` +
      '\n' +
      `Your chat ID is \`${chatId}\`` +
      '\n\n' +
      `Use this chat ID to connect your Telegram account to your Swetrix account on ${SWETRIX_SETTINGS_URL}.`
    await ctx.reply(text, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...(user && {
        reply_markup: {
          keyboard: [[{ text: 'Projects' }]],
          resize_keyboard: true,
        },
      }),
    })
  }

  @On('callback_query')
  async callbackQuery(
    @Ctx() ctx: Context,
    @Sender('id') chatId: string,
  ): Promise<void> {
    const [action, entityId] = ctx.callbackQuery?.['data'].split(':')

    if (action === 'confirmTelegramChatId') {
      await ctx.telegram.deleteMessage(
        ctx.chat.id,
        ctx.callbackQuery?.['message'].message_id,
      )
      await ctx.telegram.sendMessage(
        ctx.chat.id,
        '✅ Your Telegram account is connected to your Swetrix account.',
        {
          reply_markup: {
            keyboard: [[{ text: 'Projects' }]],
            resize_keyboard: true,
          },
        },
      )

      await this.userService.update(entityId, {
        telegramChatId: ctx.chat.id,
        isTelegramChatIdConfirmed: true,
      })
    }

    if (action === 'cancelTelegramChatId') {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        ctx.callbackQuery?.['message'].message_id,
        undefined,
        '❌ Your Telegram account is not connected to your Swetrix account.',
      )

      await this.userService.update(entityId, {
        telegramChatId: null,
      })
    }

    if (action === 'project') {
      const project = await this.projectService.findOne(entityId)

      if (!project) {
        return
      }

      const user = await this.userService.findOneWhere({
        telegramChatId: chatId,
      })

      if (!user) {
        return
      }

      const onlineUserCount = await this.analyticsService.getOnlineUserCount(
        project.id,
      )

      const stats = await this.analyticsService.getSummary([project.id], 'w')

      const text =
        `📊 *${project.name}*` +
        '\n\n' +
        '*Information*' +
        '\n' +
        `ID: \`${project.id}\`` +
        '\n' +
        `Active: \`${project.active ? 'yes' : 'no'}\`` +
        '\n' +
        `Public: \`${project.public ? 'yes' : 'no'}\`` +
        '\n' +
        `Created: \`${dayjs
          .utc(project.created)
          .tz(user.timezone)
          .format('YYYY-MM-DD HH:mm:ss')}\`` +
        '\n\n' +
        '*Analytics (last 7 days)*' +
        '\n' +
        `Online users: \`${onlineUserCount.length}\`` +
        '\n' +
        `Page views: \`${stats[project.id].thisWeek}\`` +
        '\n' +
        `Unique page views: \`${stats[project.id].thisWeekUnique}\`` +
        '\n\n' +
        '*Alerts*' +
        '\n' +
        `Online users: \`${
          project.alertIfOnlineUsersExceeds ? 'seted' : 'not seted'
        }\`` +
        '\n' +
        `Additional: \`${
          project.isAdditionalAlertEnabled ? 'seted' : 'not seted'
        }\``
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '⬅️ Back',
                callback_data: 'projects',
              },
            ],
          ],
        },
      })
    }

    if (action === 'projects') {
      const user = await this.userService.findOneWhere({
        telegramChatId: chatId,
      })

      if (!user) {
        return
      }

      const projects = await this.projectService.findWhere({ admin: user.id })

      if (projects.length === 0) {
        await ctx.reply('You have no projects yet.')
        return
      }

      const keyboard = projects.map(project => [
        {
          text: project.name,
          callback_data: `project:${project.id}`,
        },
      ])

      await ctx.editMessageText('Your projects:', {
        reply_markup: {
          inline_keyboard: keyboard,
        },
      })
    }
  }

  @Hears('Projects')
  async projects(
    @Sender('id') chatId: string,
    @Ctx() ctx: Context,
  ): Promise<void> {
    const user = await this.userService.findOneWhere({ telegramChatId: chatId })

    if (!user) {
      return
    }

    const projects = await this.projectService.findWhere({ admin: user.id })

    if (projects.length === 0) {
      await ctx.reply('You have no projects yet.')
      return
    }

    const keyboard = projects.map(project => [
      {
        text: project.name,
        callback_data: `project:${project.id}`,
      },
    ])

    await ctx.reply('Your projects:', {
      reply_markup: {
        inline_keyboard: keyboard,
        resize_keyboard: true,
      },
    })
  }
}
