import type { IconProps } from './icons/props.ts'
import { BRAND_MARK_DATA_URI } from './brandMarkData.ts'

/** Native viewBox of the brand mark (square artboard). */
export const FISH_LOGO_VIEWBOX = { width: 200, height: 200 }

/**
 * @deprecated Empty — the whale path was removed. Prefer {@link FishLogo}.
 */
export const FISH_LOGO_PATH = ''

/**
 * Product brand mark (delivery-van artwork), tinted with `currentColor`.
 * @param props.size - width and height in px (default 24).
 * @param props.className - extra class for layout placement.
 * @returns the logo element (aria-hidden).
 */
export function FishLogo({ size = 24, className }: IconProps) {
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
        backgroundColor: 'currentColor',
        WebkitMaskImage: `url(${BRAND_MARK_DATA_URI})`,
        maskImage: `url(${BRAND_MARK_DATA_URI})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  )
}
