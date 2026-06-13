import { useI18n } from '../lib/i18n'
import { loadThemeSettings, PALETTES } from '../lib/theme'
import { Spotlight } from './ui/spotlight'
import logo from '../assets/logo.svg'

/** 首次啟動（尚未選擇 vault）時的全螢幕引導畫面 */
export function VaultSetup({ onPick }: { onPick: () => void }): React.JSX.Element {
  const { t } = useI18n()
  // 按鈕漸層沿用當前主題調色盤，與 app 視覺一致
  const palette = PALETTES.find((p) => p.id === loadThemeSettings().palette) ?? PALETTES[0]
  return (
    <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-white px-6 text-center dark:bg-zinc-950 dark:text-zinc-100">
      {/* 水平鏡像把光暈放到右上角、往左下散；Spotlight 自身的滑入動畫不受影響 */}
      <div className="pointer-events-none absolute inset-0 scale-x-[-1]">
        <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="var(--secondary)" />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-5">
        <img src={logo} alt="Lattic" className="h-14 w-14 rounded-2xl shadow-sm" />
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold">{t('vaultSetup.title')}</h1>
          <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            {t('vaultSetup.desc')}
          </p>
        </div>
        <button
          onClick={onPick}
          style={{
            // 斜向漸層 + 第二色加深一階，過渡更自然（color-mix 對各調色盤通用）
            backgroundImage: `linear-gradient(to bottom right, ${palette.colors[0]}, color-mix(in oklab, ${palette.colors[1]} 82%, black))`
          }}
          className="rounded-xl px-7 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:brightness-105 active:scale-95"
        >
          {t('vaultSetup.pick')}
        </button>
      </div>
    </div>
  )
}
