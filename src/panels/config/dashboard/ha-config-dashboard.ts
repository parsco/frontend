import type { ActionDetail } from "@material/mwc-list";
import {
  mdiCloudLock,
  mdiDotsVertical,
  mdiMagnify,
  mdiPower,
  mdiRefresh,
} from "@mdi/js";
import type { UnsubscribeFunc } from "home-assistant-js-websocket";
import {
  CSSResultGroup,
  LitElement,
  PropertyValues,
  TemplateResult,
  css,
  html,
} from "lit";
import { customElement, property, state } from "lit/decorators";
import memoizeOne from "memoize-one";
import { isComponentLoaded } from "../../../common/config/is_component_loaded";
import "../../../components/chips/ha-assist-chip";
import "../../../components/ha-button-menu";
import "../../../components/ha-card";
import "../../../components/ha-icon-button";
import "../../../components/ha-icon-next";
import "../../../components/ha-list-item";
import "../../../components/ha-menu-button";
import "../../../components/ha-svg-icon";
import "../../../components/ha-tip";
import "../../../components/ha-top-app-bar-fixed";
import { CloudStatus } from "../../../data/cloud";
import {
  RepairsIssue,
  severitySort,
  subscribeRepairsIssueRegistry,
} from "../../../data/repairs";
import {
  UpdateEntity,
  checkForEntityUpdates,
  filterUpdateEntitiesWithInstall,
} from "../../../data/update";
import { showQuickBar } from "../../../dialogs/quick-bar/show-dialog-quick-bar";
import { showRestartDialog } from "../../../dialogs/restart/show-dialog-restart";
import { PageNavigation } from "../../../layouts/hass-tabs-subpage";
import { SubscribeMixin } from "../../../mixins/subscribe-mixin";
import { haStyle } from "../../../resources/styles";
import { HomeAssistant } from "../../../types";
import { documentationUrl } from "../../../util/documentation-url";
import "../ha-config-section";
import { configSections } from "../ha-panel-config";
import "../repairs/ha-config-repairs";
import "./ha-config-navigation";
import "./ha-config-updates";

const randomTip = (hass: HomeAssistant, narrow: boolean) => {
  const weighted: string[] = [];
  let tips = [
    {
      content: hass.localize("ui.panel.config.tips.join", {
        forums: html`<a
          href="#"
          target="_blank"
          rel="noreferrer"
          >${hass.localize("ui.panel.config.tips.join_forums")}</a
        >`,
        twitter: html``,
        discord: html``,
        blog: html``,
        newsletter: html`<span class="keep-together"

        </span>`,
      }),
      weight: 2,
      narrow: true,
    },
  ];

  if (hass?.enableShortcuts) {
    tips.push(
      {
        content: hass.localize("ui.tips.key_c_hint"),
        weight: 1,
        narrow: false,
      },
      { content: hass.localize("ui.tips.key_m_hint"), weight: 1, narrow: false }
    );
  }

  if (narrow) {
    tips = tips.filter((tip) => tip.narrow);
  }

  tips.forEach((tip) => {
    for (let i = 0; i < tip.weight; i++) {
      weighted.push(tip.content);
    }
  });

  return weighted[Math.floor(Math.random() * weighted.length)];
};

@customElement("ha-config-dashboard")
class HaConfigDashboard extends SubscribeMixin(LitElement) {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ type: Boolean, reflect: true }) public narrow = false;

  @property({ type: Boolean }) public isWide = false;

  @property({ attribute: false }) public cloudStatus?: CloudStatus;

  @property({ type: Boolean }) public showAdvanced = false;

  @state() private _tip?: string;

  @state() private _repairsIssues: { issues: RepairsIssue[]; total: number } = {
    issues: [],
    total: 0,
  };

  private _pages = memoizeOne((cloudStatus, isCloudLoaded) => {
    const pages: PageNavigation[] = [];
    if (isCloudLoaded) {
      pages.push({
        component: "cloud",
        path: ":8083/index.php",
        name: "WiFi",
        info: cloudStatus,
        iconPath: mdiWifi,
        iconColor: "#DC0000",
        translationKey: "WiFi",
      });
    }
    return [...pages, ...configSections.dashboard];
  });

  public hassSubscribe(): UnsubscribeFunc[] {
    return [
      subscribeRepairsIssueRegistry(this.hass.connection!, (repairs) => {
        const repairsIssues = repairs.issues.filter((issue) => !issue.ignored);

        this._repairsIssues = {
          issues: repairsIssues
            .sort((a, b) => severitySort[a.severity] - severitySort[b.severity])
            .slice(0, repairsIssues.length === 3 ? repairsIssues.length : 2),
          total: repairsIssues.length,
        };

        const integrations: Set<string> = new Set();
        for (const issue of this._repairsIssues.issues) {
          integrations.add(issue.domain);
        }
        this.hass.loadBackendTranslation("issues", [...integrations]);
      }),
    ];
  }

  protected render(): TemplateResult {
    const { updates: canInstallUpdates, total: totalUpdates } =
      this._filterUpdateEntitiesWithInstall(
        this.hass.states,
        this.hass.entities
      );

    const { issues: repairsIssues, total: totalRepairIssues } =
      this._repairsIssues;

    return html`
      <ha-top-app-bar-fixed>
        <ha-menu-button
          slot="navigationIcon"
          .hass=${this.hass}
          .narrow=${this.narrow}
        ></ha-menu-button>
        <div slot="title">${this.hass.localize("panel.config")}</div>

        <ha-icon-button
          slot="actionItems"
          .label=${this.hass.localize("ui.dialogs.quick-bar.title")}
          .path=${mdiMagnify}
          @click=${this._showQuickBar}
        ></ha-icon-button>
        <ha-button-menu slot="actionItems" @action=${this._handleMenuAction}>
          <ha-icon-button
            slot="trigger"
            .label=${this.hass.localize("ui.common.menu")}
            .path=${mdiDotsVertical}
          ></ha-icon-button>

          <ha-list-item graphic="icon">
            ${this.hass.localize("ui.panel.config.updates.check_updates")}
            <ha-svg-icon slot="graphic" .path=${mdiRefresh}></ha-svg-icon>
          </ha-list-item>

          <ha-list-item graphic="icon">
            ${this.hass.localize(
              "ui.panel.config.system_dashboard.restart_homeassistant"
            )}
            <ha-svg-icon slot="graphic" .path=${mdiPower}></ha-svg-icon>
          </ha-list-item>
        </ha-button-menu>

        <ha-config-section
          .narrow=${this.narrow}
          .isWide=${this.isWide}
          full-width
        >
          ${repairsIssues.length || canInstallUpdates.length
            ? html`<ha-card outlined>
                ${repairsIssues.length
                  ? html`
                      <ha-config-repairs
                        .hass=${this.hass}
                        .narrow=${this.narrow}
                        .total=${totalRepairIssues}
                        .repairsIssues=${repairsIssues}
                      ></ha-config-repairs>
                      ${totalRepairIssues > repairsIssues.length
                        ? html`
                            <ha-assist-chip
                              href="/config/repairs"
                              .label=${this.hass.localize(
                                "ui.panel.config.repairs.more_repairs",
                                {
                                  count:
                                    totalRepairIssues - repairsIssues.length,
                                }
                              )}
                            >
                            </ha-assist-chip>
                          `
                        : ""}
                    `
                  : ""}
                ${repairsIssues.length && canInstallUpdates.length
                  ? html`<hr />`
                  : ""}
                ${canInstallUpdates.length
                  ? html`
                      <ha-config-updates
                        .hass=${this.hass}
                        .narrow=${this.narrow}
                        .total=${totalUpdates}
                        .updateEntities=${canInstallUpdates}
                      ></ha-config-updates>
                      ${totalUpdates > canInstallUpdates.length
                        ? html`
                            <ha-assist-chip
                              href="/config/updates"
                              label=${this.hass.localize(
                                "ui.panel.config.updates.more_updates",
                                {
                                  count:
                                    totalUpdates - canInstallUpdates.length,
                                }
                              )}
                            >
                            </ha-assist-chip>
                          `
                        : ""}
                    `
                  : ""}
              </ha-card>`
            : ""}

          <ha-card outlined>
            <ha-config-navigation
              .hass=${this.hass}
              .narrow=${this.narrow}
              .showAdvanced=${this.showAdvanced}
              .pages=${this._pages(
                this.cloudStatus,
                isComponentLoaded(this.hass, "cloud")
              )}
            ></ha-config-navigation>
          </ha-card>
          <ha-tip .hass=${this.hass}>${this._tip}</ha-tip>
        </ha-config-section>
      </ha-top-app-bar-fixed>
    `;
  }

  protected override updated(changedProps: PropertyValues): void {
    super.updated(changedProps);

    if (!this._tip && changedProps.has("hass")) {
      this._tip = randomTip(this.hass, this.narrow);
    }
  }

  private _filterUpdateEntitiesWithInstall = memoizeOne(
    (
      entities: HomeAssistant["states"],
      entityRegistry: HomeAssistant["entities"]
    ): { updates: UpdateEntity[]; total: number } => {
      const updates = filterUpdateEntitiesWithInstall(entities).filter(
        (entity) => !entityRegistry[entity.entity_id]?.hidden
      );

      return {
        updates: updates.slice(0, updates.length === 3 ? updates.length : 2),
        total: updates.length,
      };
    }
  );

  private _showQuickBar(): void {
    showQuickBar(this, {
      commandMode: true,
      hint: this.hass.enableShortcuts
        ? this.hass.localize("ui.dialogs.quick-bar.key_c_hint")
        : undefined,
    });
  }

  private async _handleMenuAction(ev: CustomEvent<ActionDetail>) {
    switch (ev.detail.index) {
      case 0:
        checkForEntityUpdates(this, this.hass);
        break;
      case 1:
        showRestartDialog(this);
        break;
    }
  }

  static get styles(): CSSResultGroup {
    return [
      haStyle,
      css`
        ha-card:last-child {
          margin-bottom: env(safe-area-inset-bottom);
        }
        :host(:not([narrow])) ha-card:last-child {
          margin-bottom: max(24px, env(safe-area-inset-bottom));
        }
        ha-config-section {
          margin: auto;
          margin-top: -32px;
          max-width: 600px;
        }
        ha-card {
          overflow: hidden;
        }
        ha-card a {
          text-decoration: none;
          color: var(--primary-text-color);
        }
        ha-assist-chip {
          margin: 8px 16px 16px 16px;
        }
        .title {
          font-size: 16px;
          padding: 16px;
          padding-bottom: 0;
        }

        @media all and (max-width: 600px) {
          ha-card {
            border-width: 1px 0;
            border-radius: 0;
            box-shadow: unset;
          }
          ha-config-section {
            margin-top: -42px;
          }
        }

        ha-tip {
          margin-bottom: max(env(safe-area-inset-bottom), 8px);
        }

        .new {
          color: var(--primary-color);
        }

        .keep-together {
          display: inline-block;
        }

        hr {
          height: 1px;
          background-color: var(
            --ha-card-border-color,
            var(--divider-color, #e0e0e0)
          );
          border: none;
          margin-top: 0;
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-config-dashboard": HaConfigDashboard;
  }
}
