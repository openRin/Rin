import {
  SearchableSelect,
  SettingsBadge,
  SettingsCard,
  SettingsCardBody,
  SettingsCardHeader,
  SettingsCardRow,
} from "@rin/ui";
import * as Switch from "@radix-ui/react-switch";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ReactLoading from "react-loading";
import { client } from "../app/runtime";
import { Button } from "../components/button";
import { useAlert } from "../components/dialog";
import { ItemTitle } from "./settings-items";
import {
  AI_MODEL_PRESETS,
  AI_PROVIDER_PRESETS,
  buildAITestRequest,
  getAIProviderFields,
  getAIProviderPreset,
} from "./settings-helpers";

export type AISettingsValue = {
  enabled: boolean;
  provider: string;
  model: string;
  apiKey: string;
  apiKeySet: boolean;
  apiUrl: string;
};

export function AISummarySettings({
  value,
  onChange,
}: {
  value: AISettingsValue;
  onChange: (updates: Partial<AISettingsValue>) => void;
}) {
  const { t } = useTranslation();
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<{ success?: boolean; response?: string; error?: string; details?: string } | null>(null);
  const { AlertUI } = useAlert();
  const providerFields = getAIProviderFields(value.provider);

  const handleProviderChange = (nextProvider: string) => {
    const preset = getAIProviderPreset(nextProvider);
    const models = AI_MODEL_PRESETS[nextProvider] || [];

    onChange({
      provider: nextProvider,
      apiUrl: preset?.url ?? "",
      model: models[0] ?? value.model,
    });
  };

  const handleTestModel = async () => {
    setTestStatus("testing");
    setTestResult(null);
    try {
      const requestBody = buildAITestRequest({
        provider: value.provider,
        model: value.model,
        apiUrl: value.apiUrl,
        apiKey: value.apiKey,
      });
      const { data, error } = await client.config.testAI(requestBody);

      if (error) {
        setTestStatus("error");
        setTestResult({
          success: false,
          error: error.value || t("settings.ai_summary.test.failed"),
          details: t("settings.ai_summary.test.http_error$status", { status: error.status }),
        });
      } else if (data?.success) {
        setTestStatus("success");
        setTestResult({
          success: true,
          response: data.response || t("settings.ai_summary.test.success"),
        });
      } else {
        setTestStatus("error");
        setTestResult({
          success: false,
          error: data?.error || t("settings.ai_summary.test.failed"),
          details: data?.details,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTestStatus("error");
      setTestResult({
        success: false,
        error: message || t("settings.ai_summary.test.error"),
      });
    }
  };

  const modelOptions = AI_MODEL_PRESETS[value.provider] || [];

  return (
    <>
      <ItemTitle title={t("settings.ai_summary.title")} />
      <SettingsCard>
        <SettingsCardRow
          header={<SettingsCardHeader title={t("settings.ai_summary.enable.title")} description={t("settings.ai_summary.enable.desc")} />}
          action={
            <Switch.Root
              className="SwitchRoot"
              checked={value.enabled}
              onCheckedChange={(checked) => {
                onChange({ enabled: checked });
              }}
            >
              <Switch.Thumb className="SwitchThumb" />
            </Switch.Root>
          }
        />
      </SettingsCard>

      {value.enabled && (
        <>
          <SettingsCard>
            <SettingsCardRow
              header={<SettingsCardHeader title={t("settings.ai_summary.provider.title")} description={t("settings.ai_summary.provider.desc")} />}
              action={
                <SearchableSelect
                  value={value.provider}
                  onChange={handleProviderChange}
                  options={AI_PROVIDER_PRESETS.map((preset) => ({
                    label: preset.label,
                    value: preset.value,
                  }))}
                  placeholder={t("settings.ai_summary.provider.title")}
                  searchable={false}
                />
              }
            />
            <SettingsCardBody>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium t-primary">{t("settings.ai_summary.model.title")}</p>
                  <SearchableSelect
                    value={value.model}
                    onChange={(nextValue) => {
                      onChange({ model: nextValue });
                    }}
                    options={modelOptions.map((option) => ({
                      label: option,
                      value: option,
                    }))}
                    placeholder={t("settings.ai_summary.model.desc")}
                    searchPlaceholder={t("settings.ai_summary.model.desc")}
                    emptyLabel={t("no_more")}
                    allowCustomValue
                    customValueLabel={(nextValue) => `${t("update.title")}: ${nextValue}`}
                  />
                </div>
                {providerFields.requiresApiKey ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium t-primary">
                      {t("settings.ai_summary.api_key.title")}
                      {value.apiKeySet && (
                        <span className="ml-2">
                          <SettingsBadge tone="success">{t("settings.ai_summary.api_key.set")}</SettingsBadge>
                        </span>
                      )}
                    </p>
                    <input
                      type="password"
                      name="rin-ai-api-key"
                      autoComplete="new-password"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={value.apiKey}
                      onChange={(event) => {
                        onChange({ apiKey: event.target.value });
                      }}
                      placeholder={value.apiKeySet ? t("settings.ai_summary.api_key.placeholder_set") : "sk-..."}
                      className="w-full rounded-xl border border-black/10 bg-w px-4 py-3 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:placeholder:text-neutral-500 dark:focus:border-white/20"
                    />
                  </div>
                ) : null}
                {providerFields.requiresApiUrl ? (
                  <div className="space-y-2 lg:col-span-2">
                    <p className="text-sm font-medium t-primary">{t("settings.ai_summary.api_url.title")}</p>
                    <input
                      type="text"
                      value={value.apiUrl}
                      onChange={(event) => {
                        onChange({ apiUrl: event.target.value });
                      }}
                      placeholder="https://api.openai.com/v1"
                      className="w-full rounded-xl border border-black/10 bg-w px-4 py-3 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:placeholder:text-neutral-500 dark:focus:border-white/20"
                    />
                  </div>
                ) : null}
              </div>
            </SettingsCardBody>
          </SettingsCard>

          <SettingsCard tone={testStatus === "error" ? "danger" : testStatus === "success" ? "success" : "default"}>
            <SettingsCardRow
              header={<SettingsCardHeader title={t("settings.ai_summary.test.title")} description={t("settings.ai_summary.test.desc")} />}
              action={
                <>
                  {testStatus === "testing" && <ReactLoading width="1em" height="1em" type="spin" color="#FC466B" />}
                  <Button
                    title={t("settings.ai_summary.test.button")}
                    onClick={handleTestModel}
                    disabled={testStatus === "testing"}
                  />
                </>
              }
            />
            {testStatus === "success" && testResult && (
              <SettingsCardBody>
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">{t("settings.ai_summary.test.success")}</p>
                <p className="mt-1 text-sm text-green-700/90 dark:text-green-300/90">{testResult.response}</p>
              </SettingsCardBody>
            )}
            {testStatus === "error" && testResult && (
              <SettingsCardBody>
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{t("settings.ai_summary.test.failed")}</p>
                {testResult.error && <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">{testResult.error}</p>}
                {testResult.details && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{testResult.details}</p>}
                {!testResult.error && !testResult.details && (
                  <p className="mt-1 text-xs text-red-700 dark:text-red-300">{JSON.stringify(testResult)}</p>
                )}
              </SettingsCardBody>
            )}
          </SettingsCard>
        </>
      )}
      <AlertUI />
    </>
  );
}
