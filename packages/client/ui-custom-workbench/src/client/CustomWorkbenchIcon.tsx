/** Decorative occupant for the custom workbench sidebar entry. */

import { IconPanelLeftOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Render the panel glyph at the size the sidebar asks for.
 * @param props - the sidebar's icon share: the requested edge and whether the panel is selected.
 * @returns the icon element.
 */
export function CustomWorkbenchIcon({ size }: PropsRuntime<'sidebar.panellist'>) {
  return <IconPanelLeftOutlineRegular size={size} />
}
