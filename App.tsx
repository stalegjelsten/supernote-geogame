/**
 * Geogame – meny som åpnes fra verktøylinja i NOTE.
 *
 * Laget for e-blekk: svart på hvitt, kompakte men tydelige trykkflater, ingen animasjoner.
 */
import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';
import {countElementsOnPage, createSheet, gradeSheet, rowsPerPageNow} from './src/actions';
import {createMapSheet, gradeMapSheet, skillOfTarget} from './src/mapActions';
import type {SheetRecord} from './src/core/stats';
import {statsReport} from './src/core/statsReport';
import {statsTexts} from './src/i18n/stats';
import {clearRecords, loadRecords} from './src/sdk/statsStore';
import {
  MAP_COUNTS,
  MAP_ENTRY_STYLES,
  MAP_SHEET_COUNT,
  type MapTarget,
} from './src/core/mapSheet';
import {mapTexts, type MapEntryStyle} from './src/i18n/map';
import {
  MAX_PER_PAGE,
  regionName,
  regionSize,
  type Region,
} from './src/core/sheet';
import {
  LANGUAGES,
  currentLanguage,
  deviceLanguage,
  languageChoice,
  onLanguageChange,
  setLanguageChoice,
  type LanguageChoice,
} from './src/i18n';

/** Tegner menyen på nytt når språket endres (på enheten eller i menyen). */
function useLanguage() {
  const [, setTick] = useState(0);
  useEffect(() => onLanguageChange(() => setTick(t => t + 1)), []);
  return {
    t: currentLanguage(),
    choice: languageChoice(),
    device: deviceLanguage(),
  };
}

const REGIONS: Region[] = ['EU', 'AS', 'AF', 'NA', 'SA', 'OC', 'ALL'];
const COUNTS: Count[] = [10, 15, 20, 'ALL'];

type Count = number | 'ALL';

/** Tabell: skriv hovedstaden. Kart: merk hovedstaden på kartet. */
type Mode = 'table' | 'map';

type Status =
  | {kind: 'idle'}
  | {kind: 'busy'; message: string}
  | {kind: 'confirm'; elements: number}
  | {kind: 'done'; message: string; detail?: string}
  | {kind: 'error'; message: string};

function Button({
  label,
  onPress,
  selected,
  primary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
  primary?: boolean;
  disabled?: boolean;
}) {
  const filled = selected || primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        filled && styles.buttonFilled,
        disabled && styles.buttonDisabled,
      ]}>
      <Text style={[styles.buttonText, filled && styles.buttonTextFilled]}>
        {label}
      </Text>
    </Pressable>
  );
}

function App(): React.JSX.Element {
  const {t, choice, device} = useLanguage();
  const ui = t.ui;
  const mt = mapTexts(t);
  const [mode, setMode] = useState<Mode>('table');
  const [region, setRegion] = useState<Region>('EU');
  const [count, setCount] = useState<Count>(20);
  const [mapCount, setMapCount] = useState<number>(MAP_SHEET_COUNT);
  const [mapStyle, setMapStyle] = useState<MapEntryStyle>('both');
  const [mapTarget, setMapTarget] = useState<MapTarget>('capital');
  const styleLabel: Record<MapEntryStyle, string> = {
    both: mt.ui.showBoth,
    capital: mt.ui.showCapital,
    country: mt.ui.showCountry,
  };
  const actualCount =
    count === 'ALL' ? regionSize(region) : Math.min(count, regionSize(region));
  // Land per side avhenger av sidestørrelsen (20 på Manta, færre på Nomad og A5X).
  const [perPage, setPerPage] = useState(MAX_PER_PAGE);
  useEffect(() => {
    rowsPerPageNow().then(n => n && setPerPage(n));
  }, []);
  const pageCount = Math.ceil(actualCount / perPage);
  const [status, setStatus] = useState<Status>({kind: 'idle'});
  const [allLanguages, setAllLanguages] = useState(false);
  // Uten «alle språk» vises bare automatisk, valgt språk og enhetens språk.
  const shownLanguages = allLanguages
    ? LANGUAGES
    : LANGUAGES.filter(l => l.code === choice || l.code === device.code);
  const busy = status.kind === 'busy';

  // Statistikk: postene hentes når visningen åpnes og etter hver retting.
  const stx = statsTexts(t);
  const [statsOpen, setStatsOpen] = useState(false);
  const [records, setRecords] = useState<SheetRecord[] | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const skill = mode === 'table' ? 'capital' : skillOfTarget(mapTarget);
  const report = useMemo(
    () =>
      records ? statsReport(records, skill, t, region, Date.now()) : null,
    [records, skill, t, region],
  );
  const refreshStats = () => loadRecords().then(setRecords);
  const toggleStats = () => {
    setConfirmReset(false);
    if (!statsOpen) {
      refreshStats();
    }
    setStatsOpen(o => !o);
  };
  const resetStats = async () => {
    setConfirmReset(false);
    try {
      await clearRecords();
      setStatus({kind: 'done', message: stx.resetDone});
    } catch (e) {
      setStatus({kind: 'error', message: (e as Error).message ?? String(e)});
    }
    refreshStats();
  };

  const close = () => {
    setStatus({kind: 'idle'});
    PluginManager.closePluginView();
  };

  const run = async (
    task: () => Promise<{message: string; detail?: string}>,
    closeAfter: boolean,
  ) => {
    try {
      const {message, detail} = await task();
      if (closeAfter) {
        close();
      } else {
        setStatus({kind: 'done', message, detail});
      }
    } catch (e) {
      setStatus({kind: 'error', message: (e as Error).message ?? String(e)});
    }
    if (statsOpen) {
      refreshStats();
    }
  };

  const make = async (where: 'check' | 'here' | 'newPage') => {
    if (where === 'check') {
      try {
        setStatus({kind: 'busy', message: ui.checkingPage});
        const n = await countElementsOnPage();
        if (n > 0) {
          setStatus({kind: 'confirm', elements: n});
          return;
        }
      } catch (e) {
        setStatus({kind: 'error', message: (e as Error).message ?? String(e)});
        return;
      }
    }
    const target = where === 'check' ? 'here' : where;
    const progress = (message: string) => setStatus({kind: 'busy', message});
    await run(async () => {
      if (mode === 'map') {
        const r = await createMapSheet(t, region, target, progress, {
          count: mapCount,
          style: mapStyle,
          target: mapTarget,
        });
        return {
          message:
            mapTarget === 'country'
              ? mt.ui.countryMade(r.count)
              : mt.ui.made(r.count),
        };
      }
      const r = await createSheet(t, region, actualCount, target, progress);
      return {message: ui.made(r.countries, r.pages)};
    }, true);
  };

  const grade = (scope: 'page' | 'set') =>
    run(async () => {
      setStatus({kind: 'busy', message: ui.startingGrading});
      const started = Date.now();
      const progress = (message: string) => setStatus({kind: 'busy', message});
      // Kartark rettes alltid side for side; andre ark går videre til tabellrettingen.
      const m = await gradeMapSheet(progress);
      if (m) {
        const mapSeconds = ((Date.now() - started) / 1000).toFixed(1);
        const mapPercent = m.max ? Math.round((100 * m.points) / m.max) : 0;
        return {
          message:
            m.target === 'country'
              ? mt.ui.countryResult(m.points, m.max, mapPercent)
              : mt.ui.result(m.points, m.max, mapPercent),
          detail: ui.gradedIn(mapSeconds),
        };
      }
      const r = await gradeSheet(scope, progress);
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      const percent = r.total ? Math.round((100 * r.points) / r.total) : 0;
      const perPage =
        r.pages.length > 1
          ? r.pages
              .map(p => ui.pageScore(p.part, p.points, p.total))
              .join('\n') + '\n'
          : '';
      return {
        message: ui.result(r.points, r.total, percent),
        detail: perPage + ui.gradedIn(seconds),
      };
    }, false);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{ui.title}</Text>
        <Pressable onPress={close} style={styles.close} disabled={busy}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.section}>{ui.newSheet}</Text>
        <Text style={styles.label}>{mt.ui.mode}</Text>
        <View style={styles.grid}>
          <Button
            label={mt.ui.modeTable}
            selected={mode === 'table'}
            onPress={() => setMode('table')}
            disabled={busy}
          />
          <Button
            label={mt.ui.modeMap}
            selected={mode === 'map'}
            onPress={() => setMode('map')}
            disabled={busy}
          />
        </View>
        <Text style={styles.label}>{ui.region}</Text>
        <View style={styles.grid}>
          {REGIONS.map(r => (
            <Button
              key={r}
              label={regionName(r, t)}
              selected={r === region}
              onPress={() => setRegion(r)}
              disabled={busy}
            />
          ))}
        </View>
        {mode === 'map' ? (
          <>
            <Text style={styles.label}>{mt.ui.target}</Text>
            <View style={styles.grid}>
              <Button
                label={mt.ui.targetCapital}
                selected={mapTarget === 'capital'}
                onPress={() => setMapTarget('capital')}
                disabled={busy}
              />
              <Button
                label={mt.ui.targetCountry}
                selected={mapTarget === 'country'}
                onPress={() => setMapTarget('country')}
                disabled={busy}
              />
            </View>
            {mapTarget === 'capital' && (
              <>
                <Text style={styles.label}>{mt.ui.show}</Text>
                <View style={styles.grid}>
                  {MAP_ENTRY_STYLES.map(st => (
                    <Button
                      key={st}
                      label={styleLabel[st]}
                      selected={st === mapStyle}
                      onPress={() => setMapStyle(st)}
                      disabled={busy}
                    />
                  ))}
                </View>
              </>
            )}
            <Text style={styles.label}>{mt.ui.mapCount}</Text>
            <View style={styles.grid}>
              {MAP_COUNTS.map(c => (
                <Button
                  key={c}
                  label={String(c)}
                  selected={c === mapCount}
                  onPress={() => setMapCount(c)}
                  disabled={busy}
                />
              ))}
            </View>
            <Text style={styles.hint}>{mt.ui.mapHint}</Text>
          </>
        ) : (
          <>
            <Text style={styles.label}>{ui.count}</Text>
            <View style={styles.grid}>
              {COUNTS.map(c => (
                <Button
                  key={String(c)}
                  label={c === 'ALL' ? ui.all(regionSize(region)) : String(c)}
                  selected={c === count}
                  onPress={() => setCount(c)}
                  disabled={busy}
                />
              ))}
            </View>
            {pageCount > 1 && (
              <Text style={styles.label}>
                {ui.spread(actualCount, pageCount)}
              </Text>
            )}
          </>
        )}
        <Button
          label={ui.make}
          primary
          onPress={() => make('check')}
          disabled={busy}
        />

        {status.kind === 'confirm' && (
          <View style={styles.box}>
            <Text style={styles.message}>
              {ui.pageHasContent(status.elements)}
            </Text>
            <View style={styles.grid}>
              <Button
                label={ui.makeOnNewPage}
                primary
                onPress={() => make('newPage')}
              />
              <Button label={ui.putOnThisPage} onPress={() => make('here')} />
              <Button
                label={ui.cancel}
                onPress={() => setStatus({kind: 'idle'})}
              />
            </View>
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.section}>{ui.doneWriting}</Text>
        <View style={styles.grid}>
          <Button
            label={ui.gradePage}
            primary
            onPress={() => grade('page')}
            disabled={busy}
          />
          {mode === 'table' && (
            <Button
              label={ui.gradeSet}
              primary
              onPress={() => grade('set')}
              disabled={busy}
            />
          )}
        </View>

        {status.kind === 'busy' && (
          <View style={styles.box}>
            <Text style={styles.message}>{status.message}</Text>
          </View>
        )}
        {status.kind === 'done' && (
          <View style={styles.box}>
            <Text style={styles.score}>{status.message}</Text>
            {status.detail ? (
              <Text style={styles.message}>{status.detail}</Text>
            ) : null}
            <Button label={ui.showSheet} primary onPress={close} />
          </View>
        )}
        {status.kind === 'error' && (
          <View style={styles.box}>
            <Text style={styles.message}>
              {ui.somethingWrong(status.message)}
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.section}>{stx.section}</Text>
        <Button
          label={statsOpen ? stx.hide : stx.show}
          onPress={toggleStats}
          disabled={busy}
        />
        {statsOpen && (
          <View style={styles.box}>
            {!report ? (
              <Text style={styles.message}>{stx.loading}</Text>
            ) : (
              <>
                <Text style={styles.label}>{stx.skill[skill]}</Text>
                {report.sessions.sheets === 0 ? (
                  <Text style={styles.message}>{stx.none}</Text>
                ) : (
                  <>
                    <Text style={styles.message}>
                      {stx.sheets(
                        report.sessions.sheets,
                        report.sessions.attempts,
                        Math.round(100 * (report.sessions.score ?? 0)),
                      )}
                    </Text>
                    {report.regions.map(({region: r, summary: s}) => (
                      <Text
                        key={r}
                        style={[
                          styles.hint,
                          r === region && styles.hintSelected,
                        ]}>
                        {stx.region(
                          regionName(r, t),
                          s.known,
                          s.learning,
                          s.new,
                        )}
                      </Text>
                    ))}
                    {report.focus.summary.due > 0 && (
                      <Text style={styles.message}>
                        {stx.due(report.focus.summary.due)}
                      </Text>
                    )}
                    {report.weakest.length > 0 && (
                      <>
                        <Text style={styles.label}>
                          {stx.weakest} ({regionName(region, t)})
                        </Text>
                        {report.weakest.map(w => (
                          <Text key={w.code} style={styles.hint}>
                            {stx.weakItem(w.name, w.answer, w.percent, w.attempts)}
                          </Text>
                        ))}
                      </>
                    )}
                    {confirmReset ? (
                      <>
                        <Text style={styles.message}>{stx.confirmReset}</Text>
                        <View style={styles.grid}>
                          <Button
                            label={stx.confirm}
                            primary
                            onPress={resetStats}
                          />
                          <Button
                            label={stx.cancel}
                            onPress={() => setConfirmReset(false)}
                          />
                        </View>
                      </>
                    ) : (
                      <Button
                        label={stx.reset}
                        onPress={() => setConfirmReset(true)}
                        disabled={busy}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.label}>{ui.language}</Text>
        <View style={styles.grid}>
          {(
            ['auto', ...shownLanguages.map(l => l.code)] as LanguageChoice[]
          ).map(c => (
            <Button
              key={c}
              label={
                c === 'auto'
                  ? ui.automatic(device.label)
                  : LANGUAGES.find(l => l.code === c)!.label
              }
              selected={c === choice}
              onPress={() => setLanguageChoice(c)}
              disabled={busy}
            />
          ))}
          <Button
            label={
              allLanguages
                ? ui.fewerLanguages
                : ui.allLanguages(LANGUAGES.length)
            }
            onPress={() => setAllLanguages(a => !a)}
            disabled={busy}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const BLACK = '#000000';
const WHITE = '#ffffff';
const GRAY = '#9d9d9d';

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: WHITE},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderColor: BLACK,
  },
  title: {fontSize: 26, fontWeight: '700', color: BLACK},
  close: {padding: 10},
  closeText: {fontSize: 26, fontWeight: '700', color: BLACK},
  body: {padding: 20, gap: 10},
  section: {fontSize: 22, fontWeight: '700', color: BLACK, marginTop: 4},
  label: {fontSize: 18, color: BLACK, marginTop: 4},
  hint: {fontSize: 16, color: BLACK},
  hintSelected: {fontWeight: '700'},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  button: {
    alignSelf: 'flex-start',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: BLACK,
    borderRadius: 8,
    backgroundColor: WHITE,
  },
  buttonFilled: {backgroundColor: BLACK},
  buttonDisabled: {borderColor: GRAY},
  buttonText: {fontSize: 18, color: BLACK},
  buttonTextFilled: {color: WHITE, fontWeight: '700'},
  divider: {height: 2, backgroundColor: BLACK, marginVertical: 8},
  box: {
    borderWidth: 2,
    borderColor: BLACK,
    borderRadius: 8,
    padding: 14,
    gap: 10,
  },
  message: {fontSize: 18, color: BLACK},
  score: {fontSize: 26, fontWeight: '700', color: BLACK},
});

export default App;
