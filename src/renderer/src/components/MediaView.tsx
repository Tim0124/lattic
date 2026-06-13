import { Maximize, ZoomIn, ZoomOut } from 'lucide-react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import type { VaultFile } from 'src/share/types'
import { vaultUrl } from '../lib/utils'

interface MediaViewProps {
  file: VaultFile
}

const toolButtonClass =
  'flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-zinc-500 shadow-sm backdrop-blur hover:text-zinc-800 dark:bg-zinc-800/90 dark:text-zinc-400 dark:hover:text-zinc-100'

/** 圖片與 HTML 的中欄檢視 */
export function MediaView({ file }: MediaViewProps): React.JSX.Element {
  const src = vaultUrl(file.path)

  return (
    <div className="flex h-full flex-col">
      {file.kind === 'image' ? (
        <div className="relative min-h-0 flex-1 bg-zinc-100 dark:bg-zinc-900">
          <TransformWrapper
            minScale={0.2}
            maxScale={8}
            doubleClick={{ mode: 'toggle' }}
            centerOnInit
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <div className="absolute top-3 right-3 z-10 flex gap-1">
                  <button onClick={() => zoomOut()} title="縮小" className={toolButtonClass}>
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => zoomIn()} title="放大" className={toolButtonClass}>
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => resetTransform()} title="重設" className={toolButtonClass}>
                    <Maximize className="h-3.5 w-3.5" />
                  </button>
                </div>
                <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full">
                  <div className="flex h-full w-full items-center justify-center p-8">
                    <img
                      src={src}
                      alt={file.title}
                      draggable={false}
                      className="max-h-full max-w-full rounded-lg shadow-md"
                    />
                  </div>
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        </div>
      ) : (
        // sandbox：允許執行 script 但隔離於 iframe，無法觸及 app 本體
        <iframe src={src} sandbox="allow-scripts" title={file.title} className="flex-1 bg-white" />
      )}
    </div>
  )
}
