import {PluginManager} from 'sn-plugin-lib';

let known: string | null = null;

/**
 * The plugin folder. It never changes while the plugin runs, so the device is asked until it
 * gives an answer, and that answer is kept. Throws or returns null as getPluginDirPath does.
 */
export async function pluginDirPath(): Promise<string | null> {
  if (!known) {
    known = ((await PluginManager.getPluginDirPath()) as string | null | undefined) || null;
  }
  return known;
}
