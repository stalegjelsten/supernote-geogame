/**
 * World Capitals Quiz – meny som åpnes fra verktøylinja i NOTE.
 *
 * Laget for e-blekk: svart på hvitt, kompakte men tydelige trykkflater, ingen animasjoner.
 */
import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';
import {createSheet, gradeSheet, rowsPerPageNow, sheetTarget} from './src/actions';
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
import {hotSeatTexts} from './src/i18n/hotseat';
import {levelTexts} from './src/i18n/level';
import {LEVELS, type Level} from './src/core/fairDraw';
import {
  PLAYER_COUNTS,
  sharedCount,
  winners,
  type PlayMode,
  type PlayerScore,
} from './src/core/hotseat';
import {
  MAX_PER_PAGE,
  regionName,
  regionSize,
  type Region,
} from './src/core/sheet';
import {
  LANGUAGES,
  MENU_LANGUAGES,
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

/** Tusenskille med mellomrom, så kartpoeng blir lesbare. */
const thousands = (n: number) =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Tabell: skriv hovedstaden. Kart: merk hovedstaden på kartet. */
type Mode = 'table' | 'map';

type Status =
  | {kind: 'idle'}
  | {kind: 'busy'; message: string}
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

const pct = (s: PlayerScore) => (s.max ? Math.round((100 * s.points) / s.max) : 0);

function App(): React.JSX.Element {
  const {t, choice, device} = useLanguage();
  const ui = t.ui;
  const mt = mapTexts(t);
  const hs = hotSeatTexts(t);
  const lt = levelTexts(t);
  const [level, setLevel] = useState<Level>('mixed');
  const [players, setPlayers] = useState<number>(1);
  const [playMode, setPlayMode] = useState<PlayMode>('pass');
  const game = players > 1 ? {mode: playMode, players} : undefined;
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
    ? MENU_LANGUAGES
    : MENU_LANGUAGES.filter(l => l.code === choice || l.code === device.code);
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

  // Arket lages på siden du står på hvis den er tom og blank (hvit eller ingen mal),
  // ellers på en ny side etter den. Ingen spørsmål.
  const make = async () => {
    let target: 'here' | 'newPage';
    try {
      setStatus({kind: 'busy', message: ui.checkingPage});
      target = await sheetTarget();
    } catch (e) {
      setStatus({kind: 'error', message: (e as Error).message ?? String(e)});
      return;
    }
    const progress = (message: string) => setStatus({kind: 'busy', message});
    await run(async () => {
      if (mode === 'map') {
        const r = await createMapSheet(
          t,
          region,
          target,
          progress,
          {count: mapCount, style: mapStyle, target: mapTarget, level},
          game,
        );
        if (game) {
          return {message: hs.ui.made(players, r.pages)};
        }
        return {
          message:
            mapTarget === 'country'
              ? mt.ui.countryMade(r.count)
              : mt.ui.made(r.count),
        };
      }
      const r = await createSheet(
        t,
        region,
        actualCount,
        target,
        progress,
        game,
        'random',
        level,
      );
      return {
        message: game
          ? hs.ui.made(players, r.pages)
          : ui.made(r.countries, r.pages),
      };
    }, true);
  };

  /** Vinner øverst, så poeng per spiller. */
  const scoreboard = (
    scores: PlayerScore[],
    missing: number[] | undefined,
    footer: string,
    fmt: (n: number) => string,
  ) => {
    const best = winners(scores);
    const message =
      scores.length < 2
        ? hs.ui.playerScore(scores[0].player, fmt(scores[0].points), fmt(scores[0].max), pct(scores[0]))
        : best.length === 1
        ? hs.ui.winner(best[0])
        : hs.ui.tie(best);
    const lines = scores.length < 2 ? [] : scores.map(s => hs.ui.playerScore(s.player, fmt(s.points), fmt(s.max), pct(s)));
    if (missing?.length) {
      lines.push(hs.ui.missingPages(missing));
    }
    lines.push(footer);
    return {message, detail: lines.join('\n')};
  };

  const grade = (scope: 'page' | 'set') =>
    run(async () => {
      setStatus({kind: 'busy', message: ui.startingGrading});
      const started = Date.now();
      const progress = (message: string) => setStatus({kind: 'busy', message});
      // Kartark rettes alltid side for side; andre ark går videre til tabellrettingen.
      const m = await gradeMapSheet(progress, scope);
      if (m) {
        const mapSeconds = ((Date.now() - started) / 1000).toFixed(1);
        if (m.players && m.players.length) {
          return scoreboard(m.players, m.missing, ui.gradedIn(mapSeconds), m.target === 'country' ? String : thousands);
        }
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
      if (r.players && r.players.length) {
        return scoreboard(r.players, r.missing, ui.gradedIn(seconds), String);
      }
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
        {/* Med alle landene i regionen er det ingenting å velge mellom. */}
        {!(mode === 'table' && actualCount >= regionSize(region)) && (
          <>
            <Text style={styles.label}>{lt.label}</Text>
            <View style={styles.grid}>
              {LEVELS.map(l => (
                <Button
                  key={l}
                  label={lt.names[l]}
                  selected={l === level}
                  onPress={() => setLevel(l)}
                  disabled={busy}
                />
              ))}
            </View>
            {level !== 'mixed' && <Text style={styles.hint}>{lt.hint}</Text>}
          </>
        )}
        <Text style={styles.label}>{hs.ui.players}</Text>
        <View style={styles.grid}>
          {PLAYER_COUNTS.map(n => (
            <Button
              key={n}
              label={n === 1 ? hs.ui.solo : String(n)}
              selected={n === players}
              onPress={() => setPlayers(n)}
              disabled={busy}
            />
          ))}
        </View>
        {players > 1 && (
          <>
            <Text style={styles.label}>{hs.ui.howToPlay}</Text>
            <View style={styles.grid}>
              <Button
                label={hs.ui.pass}
                selected={playMode === 'pass'}
                onPress={() => setPlayMode('pass')}
                disabled={busy}
              />
              <Button
                label={hs.ui.shared}
                selected={playMode === 'shared'}
                onPress={() => setPlayMode('shared')}
                disabled={busy}
              />
            </View>
            <Text style={styles.hint}>
              {playMode === 'pass'
                ? hs.ui.passHint
                : hs.ui.sharedHint(
                    sharedCount(
                      mode === 'map' ? mapCount : actualCount,
                      players,
                      mode === 'map' ? mapCount : regionSize(region),
                    ) / players,
                    mode === 'map' && mapTarget === 'capital'
                      ? hs.ui.unitCities
                      : hs.ui.unitCountries,
                  )}
            </Text>
          </>
        )}
        <Button
          label={ui.make}
          primary
          onPress={make}
          disabled={busy}
        />


        <View style={styles.divider} />

        <Text style={styles.section}>{ui.doneWriting}</Text>
        <View style={styles.grid}>
          <Button
            label={ui.gradePage}
            primary
            onPress={() => grade('page')}
            disabled={busy}
          />
          {(mode === 'table' || players > 1) && (
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
