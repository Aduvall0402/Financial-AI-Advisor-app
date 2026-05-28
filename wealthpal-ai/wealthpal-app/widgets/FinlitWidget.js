import React from 'react';
import { FlexWidget, TextWidget, ImageWidget } from 'react-native-android-widget';

const BG      = '#07111f';
const SURFACE = '#0d1c2e';
const BORDER  = '#172536';
const TEXT    = '#ddeeff';
const MUTED   = '#4a6a88';
const ACCENT  = '#16b7f6';
const GREEN   = '#22c55e';
const AMBER   = '#f59e0b';
const RED     = '#ef4444';
const BAR_BG  = '#2a4a6e';

// BudgetCol sits directly in a flex row and takes flex:1 itself.
// No wrapper — avoids match_parent resolving to the wrong parent.
function BudgetCol({ label, spent, limit, pct }) {
  const safePct  = isNaN(pct) || !isFinite(pct) ? 0 : pct;
  const filled   = Math.min(98, Math.max(2, Math.round(safePct)));
  const empty    = 100 - filled;
  const over     = safePct >= 100;
  const barColor = over ? RED : safePct >= 80 ? AMBER : ACCENT;

  return (
    <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
      <TextWidget
        text={label}
        style={{ color: MUTED, fontSize: 8, height: 11 }}
        maxLines={1}
        truncate="END"
      />
      <TextWidget
        text={`$${Math.round(spent)}/$${Math.round(limit)}`}
        style={{ color: over ? RED : TEXT, fontSize: 10, fontWeight: '700', height: 16, marginBottom: 4 }}
        maxLines={1}
        truncate="END"
      />
      <FlexWidget style={{ height: 5, width: 'match_parent', backgroundColor: BAR_BG, borderRadius: 3, overflow: 'hidden', flexDirection: 'row' }}>
        <FlexWidget style={{ flex: filled, height: 5, backgroundColor: barColor }} />
        <FlexWidget style={{ flex: empty,  height: 5 }} />
      </FlexWidget>
    </FlexWidget>
  );
}

export function FinlitWidget({ width, height, budgetData, statsData }) {
  const budgets = budgetData ? JSON.parse(budgetData) : [];
  const stats   = statsData  ? JSON.parse(statsData)  : {};

  const {
    yesterdaySpent   = 0,
    yesterdayTxCount = 0,
    budgetLeft       = 0,
    yesterdayDate    = 'Yesterday',
    periodLabel      = 'This Pay Period',
  } = stats;

  const pairs = [];
  for (let i = 0; i < budgets.length; i += 2) {
    pairs.push(budgets.slice(i, i + 2));
  }

  const noData = budgets.length === 0 && yesterdaySpent === 0;

  return (
    <FlexWidget style={{
      height: 'match_parent', width: 'match_parent',
      backgroundColor: BG, borderRadius: 22, padding: 16,
      flexDirection: 'column',
    }}>

      {/* ── Header ── */}
      <FlexWidget style={{
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', width: 'match_parent', marginBottom: 10,
      }}>
        <FlexWidget style={{ flexDirection: 'column' }}>
          <ImageWidget
            image={require('../assets/finlit-logo.png')}
            imageWidth={80}
            imageHeight={36}
          />
          <TextWidget text={yesterdayDate} style={{ color: MUTED, fontSize: 9, marginTop: 2 }} />
        </FlexWidget>
        <FlexWidget
          style={{
            backgroundColor: SURFACE, borderRadius: 18,
            paddingVertical: 6, paddingHorizontal: 12,
            borderWidth: 1, borderColor: BORDER,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'finlit://scan' }}
        >
          <TextWidget text="Scan Receipt" style={{ color: ACCENT, fontSize: 9, fontWeight: '600' }} />
        </FlexWidget>
      </FlexWidget>

      {/* ── Divider ── */}
      <FlexWidget style={{ height: 1, width: 'match_parent', backgroundColor: BORDER, marginBottom: 10 }} />

      {/* ── Stats card ── */}
      <FlexWidget style={{
        flexDirection: 'row', width: 'match_parent',
        backgroundColor: SURFACE, borderRadius: 14,
        borderWidth: 1, borderColor: BORDER,
        paddingVertical: 10, paddingHorizontal: 8,
        marginBottom: 10,
      }}>
        <FlexWidget style={{ flex: 1, flexDirection: 'column', alignItems: 'center' }}>
          <TextWidget text="Yesterday" style={{ color: MUTED, fontSize: 8, marginBottom: 3 }} />
          <TextWidget text={`$${yesterdaySpent.toFixed(2)}`} style={{ color: TEXT, fontSize: 13, fontWeight: '700' }} />
        </FlexWidget>
        <FlexWidget style={{ flex: 1, flexDirection: 'column', alignItems: 'center' }}>
          <TextWidget text="Transactions" style={{ color: MUTED, fontSize: 8, marginBottom: 3 }} />
          <TextWidget text={`${yesterdayTxCount}`} style={{ color: TEXT, fontSize: 13, fontWeight: '700' }} />
        </FlexWidget>
        <FlexWidget style={{ flex: 1, flexDirection: 'column', alignItems: 'center' }}>
          <TextWidget text="Budget Left" style={{ color: MUTED, fontSize: 8, marginBottom: 3 }} />
          <TextWidget
            text={`$${budgetLeft.toFixed(0)}`}
            style={{ color: budgetLeft > 0 ? GREEN : RED, fontSize: 13, fontWeight: '700' }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* ── Divider ── */}
      <FlexWidget style={{ height: 1, width: 'match_parent', backgroundColor: BORDER, marginBottom: 8 }} />

      {/* ── Budget section header ── */}
      <FlexWidget style={{
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', width: 'match_parent', marginBottom: 8,
      }}>
        <TextWidget text="Budgets" style={{ color: TEXT, fontSize: 11, fontWeight: '700' }} />
        <TextWidget text={periodLabel} style={{ color: MUTED, fontSize: 8 }} />
      </FlexWidget>

      {/* ── Budget rows: BudgetCol placed directly in the row with flex:1 ── */}
      <FlexWidget style={{ flex: 1, width: 'match_parent' }}>
        {noData ? (
          <TextWidget
            text="Open Finlit and sync your bank to load data."
            style={{ color: MUTED, fontSize: 10 }}
            maxLines={3}
          />
        ) : budgets.length === 0 ? (
          <TextWidget
            text="No budgets set. Open Finlit to create budgets."
            style={{ color: MUTED, fontSize: 10 }}
            maxLines={2}
          />
        ) : (
          pairs.map((pair, pi) => (
            <FlexWidget key={pi} style={{ flexDirection: 'row', width: 'match_parent', marginBottom: 11 }}>
              <BudgetCol
                label={pair[0].label}
                spent={pair[0].spent}
                limit={pair[0].limit}
                pct={pair[0].pct}
              />
              {/* Fixed-width spacer so both columns are mathematically equal */}
              <FlexWidget style={{ width: 20 }} />
              {pair[1] ? (
                <BudgetCol
                  label={pair[1].label}
                  spent={pair[1].spent}
                  limit={pair[1].limit}
                  pct={pair[1].pct}
                />
              ) : (
                <FlexWidget style={{ flex: 1 }} />
              )}
            </FlexWidget>
          ))
        )}
      </FlexWidget>

    </FlexWidget>
  );
}
