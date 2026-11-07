/**
 * World Capitals Quiz – menu opened from the toolbar in NOTE.
 *
 * Made for e-ink: black on white, compact but clear touch targets, no animations.
 */
import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';
import {createSheet, gradeSheet, rowsPerPageNow, sheetTarget} from './src/actions';
import {createMapSheet, gradeMapSheet, skillOfTarget} from './src/mapActions';
import {createOutlineSheet, gradeOutlineSheet} from './src/outlineActions';
import {
  OUTLINE_COUNTS,
  OUTLINE_DEFAULT_COUNT,
  OUTLINE_ROTATIONS,
  OUTLINE_SCALES,
  OUTLINE_SIZES,
  type OutlineRotation,
  type OutlineScale,
  type OutlineSize,
} from './src/core/outlineSheet';
import {outlineTexts} from './src/i18n/outline';
import {sourcesTexts} from './src/i18n/sources';
import {SKILLS, type SheetRecord, type Skill} from './src/core/stats';
import type {StatsReport} from './src/core/statsReport';
import {statsReport} from './src/core/statsReport';
import {statsTexts, type StatsTexts} from './src/i18n/stats';
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
import {trainingTexts} from './src/i18n/training';
import {STRATEGIES, type Strategy} from './src/core/training';
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

/** Redraws the menu when the language changes (on the device or in the menu). */
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

/** Thousands separator with spaces, so map scores are readable. */
const thousands = (n: number) =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Table: write the capital. Map: mark the capital on the map. Outline: name the country from its outline. */
type Mode = 'table' | 'map' | 'outline';

type Status =
  | {kind: 'idle'}
  | {kind: 'busy'; message: string}
  | {kind: 'done'; message: string; detail?: string}
  | {kind: 'error'; message: string};

/** The menu is split into tabs: make and grade sheets, statistics, language. */
type Tab = 'game' | 'stats' | 'settings';

function Button({
  label,
  onPress,
  selected,
  primary,
  disabled,
  running,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
  primary?: boolean;
  disabled?: boolean;
  /** This button started what is running now: it stays black and gets "…", while the others go gray. */
  running?: boolean;
}) {
  const filled = selected || primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({pressed}) => [
        styles.button,
        filled && styles.buttonFilled,
        disabled && !running && styles.buttonDisabled,
        // Inverted while the pen is on it, so the tap shows at once on e-ink.
        pressed && (filled ? styles.buttonPressedFilled : styles.buttonFilled),
        running && styles.buttonRunning,
      ]}>
      {({pressed}) => (
        <Text
          style={[
            styles.buttonText,
            (filled || pressed || running) && styles.buttonTextFilled,
            pressed && filled && styles.buttonTextPressedFilled,
          ]}>
          {running ? `${label} …` : label}
        </Text>
      )}
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
  const ot = outlineTexts(t);
  const [level, setLevel] = useState<Level>('mixed');
  const tt = trainingTexts(t);
  // Smart by default: with no statistics yet it draws like random.
  const [strategy, setStrategy] = useState<Strategy>('smart');
  const [players, setPlayers] = useState<number>(1);
  const [playMode, setPlayMode] = useState<PlayMode>('pass');
  const [mode, setMode] = useState<Mode>('table');
  // Outline sheets are for one player.
  const game = players > 1 && mode !== 'outline' ? {mode: playMode, players} : undefined;
  // The statistics belong to one player, so multiplayer sheets are always drawn at random.
  const usedStrategy: Strategy = game ? 'random' : strategy;
  const [region, setRegion] = useState<Region>('EU');
  const [count, setCount] = useState<Count>(20);
  const [mapCount, setMapCount] = useState<number>(MAP_SHEET_COUNT);
  const [mapStyle, setMapStyle] = useState<MapEntryStyle>('both');
  const [mapTarget, setMapTarget] = useState<MapTarget>('capital');
  const [outlineCount, setOutlineCount] = useState<number>(OUTLINE_DEFAULT_COUNT);
  const [outlineSize, setOutlineSize] = useState<OutlineSize>('large');
  const [outlineScale, setOutlineScale] = useState<OutlineScale>('fit');
  const [outlineRotation, setOutlineRotation] = useState<OutlineRotation>('none');
  const styleLabel: Record<MapEntryStyle, string> = {
    both: mt.ui.showBoth,
    capital: mt.ui.showCapital,
    country: mt.ui.showCountry,
  };
  const actualCount =
    count === 'ALL' ? regionSize(region) : Math.min(count, regionSize(region));
  // Countries per page depend on the page size (20 on Manta, fewer on Nomad and A5X).
  const [perPage, setPerPage] = useState(MAX_PER_PAGE);
  useEffect(() => {
    rowsPerPageNow().then(n => n && setPerPage(n));
  }, []);
  const pageCount = Math.ceil(actualCount / perPage);
  const [status, setStatus] = useState<Status>({kind: 'idle'});
  /** Which button started what is running now. */
  const [running, setRunning] = useState<'make' | 'gradePage' | 'gradeSet' | null>(null);
  const [allLanguages, setAllLanguages] = useState(false);
  // Without "all languages", only automatic, the chosen language and the device language are shown.
  const shownLanguages = allLanguages
    ? MENU_LANGUAGES
    : MENU_LANGUAGES.filter(l => l.code === choice || l.code === device.code);
  const busy = status.kind === 'busy';
  const runningNow = busy ? running : null;

  const [tab, setTab] = useState<Tab>('game');

  // Statistics: the records are fetched when the tab opens and after each grading.
  const stx = statsTexts(t);
  const [records, setRecords] = useState<SheetRecord[] | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [statsMessage, setStatsMessage] = useState<string | null>(null);
  // The statistics follow the selected game until a skill is chosen in the statistics tab.
  const gameSkill: Skill =
    mode === 'table' ? 'capital' : mode === 'outline' ? 'outline' : skillOfTarget(mapTarget);
  const [chosenSkill, setChosenSkill] = useState<Skill | null>(null);
  useEffect(() => setChosenSkill(null), [gameSkill]);
  const skill = chosenSkill ?? gameSkill;
  const report = useMemo(
    () =>
      records ? statsReport(records, skill, t, region, Date.now()) : null,
    [records, skill, t, region],
  );
  const refreshStats = () =>
    loadRecords()
      .then(setRecords)
      .catch(e => setStatsMessage((e as Error).message ?? String(e)));
  const openTab = (next: Tab) => {
    setConfirmReset(false);
    setStatsMessage(null);
    if (next === 'stats') {
      refreshStats();
    }
    setTab(next);
  };
  const resetStats = async () => {
    setConfirmReset(false);
    try {
      await clearRecords();
      setStatsMessage(stx.resetDone);
    } catch (e) {
      setStatsMessage(ui.somethingWrong((e as Error).message ?? String(e)));
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
    // Grading adds records; fetch them again so the statistics are fresh next time.
    setRecords(null);
  };

  // The sheet is created on the current page if it is empty and blank (white or no template),
  // otherwise on a new page after it. No questions asked.
  const make = async () => {
    let target: 'here' | 'newPage';
    try {
      setRunning('make');
      setStatus({kind: 'busy', message: ui.checkingPage});
      target = await sheetTarget();
    } catch (e) {
      setStatus({kind: 'error', message: (e as Error).message ?? String(e)});
      return;
    }
    const progress = (message: string) => setStatus({kind: 'busy', message});
    await run(async () => {
      if (mode === 'outline') {
        const r = await createOutlineSheet(t, region, target, progress, {
          count: outlineCount,
          size: outlineSize,
          scale: outlineScale,
          rotation: outlineRotation,
          level,
        }, usedStrategy);
        return {message: ot.ui.made(r.count)};
      }
      if (mode === 'map') {
        const r = await createMapSheet(
          t,
          region,
          target,
          progress,
          {count: mapCount, style: mapStyle, target: mapTarget, level, strategy: usedStrategy},
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
        usedStrategy,
        level,
      );
      return {
        message: game
          ? hs.ui.made(players, r.pages)
          : ui.made(r.countries, r.pages),
      };
    }, true);
  };

  /** Winner first, then points per player. */
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
      setRunning(scope === 'page' ? 'gradePage' : 'gradeSet');
      setStatus({kind: 'busy', message: ui.startingGrading});
      const started = Date.now();
      const progress = (message: string) => setStatus({kind: 'busy', message});
      const o = await gradeOutlineSheet(progress);
      if (o) {
        const outlineSeconds = ((Date.now() - started) / 1000).toFixed(1);
        const outlinePercent = o.total ? Math.round((100 * o.correct) / o.total) : 0;
        return {
          message: ot.ui.result(o.correct, o.total, outlinePercent),
          detail: ui.gradedIn(outlineSeconds),
        };
      }
      // Map sheets are always graded page by page; other sheets go on to table grading.
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

      <View style={styles.tabs}>
        {(
          [
            ['game', ui.newSheet],
            ['stats', stx.section],
            ['settings', ui.language],
          ] as Array<[Tab, string]>
        ).map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => openTab(k)}
            disabled={busy}
            style={[styles.tab, k === tab && styles.tabSelected]}>
            <Text style={[styles.tabText, k === tab && styles.tabTextSelected]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* The status sits right under the tabs, not at the bottom of the menu, so it is
          always on screen: on Manta the bottom of the menu is below the edge.
          The black bar is always there (empty when idle), so the menu doesn't jump down
          when something starts. A non-breaking space keeps the height of one line. */}
      <View style={styles.busyBar}>
        <Text style={styles.busyText}>{status.kind === 'busy' ? status.message : ' '}</Text>
      </View>
      {status.kind === 'done' && (
        <View style={styles.statusBar}>
          <View style={styles.statusHead}>
            <Text style={[styles.score, styles.statusText]}>{status.message}</Text>
            <Pressable onPress={() => setStatus({kind: 'idle'})} style={styles.close}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          {status.detail ? <Text style={styles.message}>{status.detail}</Text> : null}
          <Button label={ui.showSheet} primary onPress={close} />
        </View>
      )}
      {status.kind === 'error' && (
        <View style={styles.statusBar}>
          <View style={styles.statusHead}>
            <Text style={[styles.message, styles.statusText]}>{ui.somethingWrong(status.message)}</Text>
            <Pressable onPress={() => setStatus({kind: 'idle'})} style={styles.close}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.body}>
        {tab === 'game' && (
          <>
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
              <Button
                label={ot.ui.mode}
                selected={mode === 'outline'}
                onPress={() => setMode('outline')}
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
            {mode === 'outline' ? (
              <>
                <Text style={styles.label}>{mt.ui.mapCount}</Text>
                <View style={styles.grid}>
                  {OUTLINE_COUNTS.map(c => (
                    <Button
                      key={c}
                      label={String(c)}
                      selected={c === outlineCount}
                      onPress={() => setOutlineCount(c)}
                      disabled={busy}
                    />
                  ))}
                </View>
                <Text style={styles.label}>{ot.ui.size}</Text>
                <View style={styles.grid}>
                  {OUTLINE_SIZES.map(sz => (
                    <Button
                      key={sz}
                      label={ot.ui.sizes[sz]}
                      selected={sz === outlineSize}
                      onPress={() => setOutlineSize(sz)}
                      disabled={busy}
                    />
                  ))}
                </View>
                <Text style={styles.label}>{ot.ui.scale}</Text>
                <View style={styles.grid}>
                  {OUTLINE_SCALES.map(sc => (
                    <Button
                      key={sc}
                      label={ot.ui.scales[sc]}
                      selected={sc === outlineScale}
                      onPress={() => setOutlineScale(sc)}
                      disabled={busy}
                    />
                  ))}
                </View>
                {outlineScale === 'log' && <Text style={styles.hint}>{ot.ui.scaleHint}</Text>}
                <Text style={styles.label}>{ot.ui.rotation}</Text>
                <View style={styles.grid}>
                  {OUTLINE_ROTATIONS.map(rot => (
                    <Button
                      key={rot}
                      label={ot.ui.rotations[rot]}
                      selected={rot === outlineRotation}
                      onPress={() => setOutlineRotation(rot)}
                      disabled={busy}
                    />
                  ))}
                </View>
                <Text style={styles.hint}>{ot.ui.hint}</Text>
              </>
            ) : mode === 'map' ? (
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
            {/* With all the countries in the region, there is nothing to choose between. */}
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
                {!game && (
                  <>
                    <Text style={styles.label}>{tt.label}</Text>
                    <View style={styles.grid}>
                      {STRATEGIES.map(st => (
                        <Button
                          key={st}
                          label={tt.names[st]}
                          selected={st === strategy}
                          onPress={() => setStrategy(st)}
                          disabled={busy}
                        />
                      ))}
                    </View>
                    <Text style={styles.hint}>{tt.hints[strategy]}</Text>
                  </>
                )}
              </>
            )}
            {mode !== 'outline' && (
              <>
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
              </>
            )}
            <Button
              label={ui.make}
              primary
              onPress={make}
              disabled={busy}
              running={runningNow === 'make'}
            />


            <View style={styles.divider} />

            <Text style={styles.section}>{ui.checkAnswers}</Text>
            <View style={styles.grid}>
              <Button
                label={ui.gradePage}
                primary
                onPress={() => grade('page')}
                disabled={busy}
                running={runningNow === 'gradePage'}
              />
              {(mode === 'table' || (mode === 'map' && players > 1)) && (
                <Button
                  label={ui.gradeSet}
                  primary
                  onPress={() => grade('set')}
                  disabled={busy}
                  running={runningNow === 'gradeSet'}
                />
              )}
            </View>

          </>
        )}

        {tab === 'stats' && (
          <StatsView
            report={report}
            stx={stx}
            t={t}
            skill={skill}
            onSkill={setChosenSkill}
            region={region}
            onRegion={setRegion}
            message={statsMessage}
            confirmReset={confirmReset}
            onAskReset={() => setConfirmReset(true)}
            onCancelReset={() => setConfirmReset(false)}
            onReset={resetStats}
          />
        )}

        {tab === 'settings' && (
          <>
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

            <View style={styles.divider} />
            <SourcesView t={t} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** The open data the plugin uses, with the credits their licenses require. */
function SourcesView({t}: {t: ReturnType<typeof currentLanguage>}) {
  const src = sourcesTexts(t);
  return (
    <>
      <Text style={styles.section}>{src.title}</Text>
      <Text style={styles.hint}>{src.intro}</Text>
      {src.lines.map(([label, credit]) => (
        <Text key={label} style={styles.hint}>
          <Text style={styles.hintSelected}>{label}: </Text>
          {credit}
        </Text>
      ))}
      <Text style={styles.hint}>{src.changed}</Text>
    </>
  );
}

/** Known (black), learning (gray) and new (white) countries side by side, as one bar. */
function LevelBar({known, learning, fresh}: {known: number; learning: number; fresh: number}) {
  const parts: Array<[number, object]> = [
    [known, styles.barKnown],
    [learning, styles.barLearning],
    [fresh, styles.barNew],
  ];
  return (
    <View style={styles.bar}>
      {parts.map(([n, style], i) =>
        n > 0 ? <View key={i} style={[{flex: n}, style]} /> : null,
      )}
    </View>
  );
}

const TREND_HEIGHT = 80;

/** One column per graded sheet, oldest to the left, with the percentage above. */
function TrendChart({scores}: {scores: number[]}) {
  return (
    <View style={styles.trend}>
      {scores.map((score, i) => (
        <View key={i} style={styles.trendColumn}>
          <Text style={styles.trendLabel}>{Math.round(100 * score)}</Text>
          <View
            style={[styles.trendBar, {height: Math.round(TREND_HEIGHT * score)}]}
          />
        </View>
      ))}
    </View>
  );
}

function StatsView({
  report,
  stx,
  t,
  skill,
  onSkill,
  region,
  onRegion,
  message,
  confirmReset,
  onAskReset,
  onCancelReset,
  onReset,
}: {
  report: StatsReport | null;
  stx: StatsTexts;
  t: ReturnType<typeof currentLanguage>;
  skill: Skill;
  onSkill: (s: Skill) => void;
  region: Region;
  onRegion: (r: Region) => void;
  message: string | null;
  confirmReset: boolean;
  onAskReset: () => void;
  onCancelReset: () => void;
  onReset: () => void;
}) {
  return (
    <>
      <View style={styles.grid}>
        {SKILLS.map(sk => (
          <Button
            key={sk}
            label={stx.skill[sk]}
            selected={sk === skill}
            onPress={() => onSkill(sk)}
          />
        ))}
      </View>
      {message && (
        <View style={styles.box}>
          <Text style={styles.message}>{message}</Text>
        </View>
      )}
      {!report ? (
        <Text style={styles.message}>{stx.loading}</Text>
      ) : report.sessions.sheets === 0 ? (
        <Text style={styles.message}>{stx.none}</Text>
      ) : (
        <>
          <View style={styles.box}>
            <Text style={styles.score}>
              {Math.round(100 * (report.sessions.score ?? 0))} %
            </Text>
            <Text style={styles.message}>
              {stx.sheets(
                report.sessions.sheets,
                report.sessions.attempts,
                Math.round(100 * (report.sessions.score ?? 0)),
              )}
            </Text>
            {report.focus.summary.due > 0 && (
              <Text style={styles.message}>
                {stx.due(report.focus.summary.due)}
              </Text>
            )}
          </View>

          {report.recent.length > 1 && (
            <>
              <Text style={styles.label}>{stx.recent}</Text>
              <TrendChart scores={report.recent.map(r => r.score)} />
            </>
          )}

          {report.regions.map(({region: r, summary: s}) => (
            <Pressable
              key={r}
              onPress={() => onRegion(r)}
              style={[styles.regionRow, r === region && styles.regionSelected]}>
              <Text style={[styles.hint, r === region && styles.hintSelected]}>
                {stx.region(regionName(r, t), s.known, s.learning, s.new)}
              </Text>
              <LevelBar known={s.known} learning={s.learning} fresh={s.new} />
            </Pressable>
          ))}

          {report.weakest.length > 0 && (
            <>
              <Text style={styles.label}>
                {stx.weakest} ({regionName(region, t)})
              </Text>
              {report.weakest.map(w => (
                <View key={w.code} style={styles.weakRow}>
                  <Text style={[styles.hint, styles.weakText]}>
                    {stx.weakItem(w.name, w.answer, w.percent, w.attempts)}
                  </Text>
                  <View style={styles.mastery}>
                    {w.percent > 0 && (
                      <View style={[styles.barKnown, {flex: w.percent}]} />
                    )}
                    <View style={{flex: 100 - w.percent}} />
                  </View>
                </View>
              ))}
            </>
          )}

          <View style={styles.divider} />
          {confirmReset ? (
            <>
              <Text style={styles.message}>{stx.confirmReset}</Text>
              <View style={styles.grid}>
                <Button label={stx.confirm} primary onPress={onReset} />
                <Button label={stx.cancel} onPress={onCancelReset} />
              </View>
            </>
          ) : (
            <Button label={stx.reset} onPress={onAskReset} />
          )}
        </>
      )}
    </>
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
  buttonPressedFilled: {backgroundColor: WHITE, borderWidth: 4},
  buttonTextPressedFilled: {color: BLACK},
  buttonRunning: {backgroundColor: BLACK, borderColor: BLACK, borderWidth: 4},
  busyBar: {
    backgroundColor: BLACK,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  busyText: {fontSize: 24, fontWeight: '700', color: WHITE},
  statusBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 4,
    borderColor: BLACK,
  },
  statusHead: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  statusText: {flex: 1},
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
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderColor: BLACK,
  },
  tab: {
    flex: 1,
    minHeight: 56,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 2,
    borderColor: BLACK,
    backgroundColor: WHITE,
  },
  tabSelected: {backgroundColor: BLACK},
  tabText: {fontSize: 18, color: BLACK, textAlign: 'center'},
  tabTextSelected: {color: WHITE, fontWeight: '700'},
  bar: {
    flexDirection: 'row',
    height: 22,
    borderWidth: 2,
    borderColor: BLACK,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: WHITE,
  },
  barKnown: {backgroundColor: BLACK},
  barLearning: {backgroundColor: GRAY},
  barNew: {backgroundColor: WHITE},
  regionRow: {
    gap: 4,
    padding: 8,
    borderWidth: 2,
    borderColor: WHITE,
    borderRadius: 8,
  },
  regionSelected: {borderColor: BLACK},
  trend: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    borderBottomWidth: 2,
    borderColor: BLACK,
  },
  trendColumn: {flex: 1, alignItems: 'center', maxWidth: 60},
  trendLabel: {fontSize: 14, color: BLACK},
  trendBar: {width: '70%', backgroundColor: BLACK},
  weakRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  weakText: {flex: 1},
  mastery: {
    flexDirection: 'row',
    width: 100,
    height: 14,
    borderWidth: 2,
    borderColor: BLACK,
    borderRadius: 3,
    overflow: 'hidden',
  },
});

export default App;
