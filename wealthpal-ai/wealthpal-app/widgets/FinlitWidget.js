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

const CAT_COLORS = {
  GROCERY:       '#3b82f6',
  DINING:        '#22c55e',
  TRANSPORT:     '#f59e0b',
  ENTERTAINMENT: '#a855f7',
  SHOPPING:      '#ec4899',
  TRAVEL:        '#06b6d4',
  HEALTH:        '#10b981',
  UTILITIES:     '#6366f1',
  PERSONAL_CARE: '#f472b6',
  EDUCATION:     '#8b5cf6',
  FEES:          '#64748b',
  OTHER:         '#64748b',
};

const CAT_INITIALS = {
  GROCERY:       'G',
  DINING:        'D',
  TRANSPORT:     'T',
  ENTERTAINMENT: 'E',
  SHOPPING:      'S',
  TRAVEL:        'V',
  HEALTH:        'H',
  UTILITIES:     'U',
  PERSONAL_CARE: 'P',
  EDUCATION:     'Ed',
  FEES:          'F',
  OTHER:         'O',
};

function dayLabel(dateStr) {
  if (!dateStr) return '';
  const today     = new Date().toISOString().split('T')[0];
  const yest      = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === today)  return 'Today';
  if (dateStr === yest)   return 'Yesterday';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StatCard({ label, value, valueColor, sub, subColor }) {
  return (
    <FlexWidget
      style={{
        flex: 1,
        backgroundColor: SURFACE,
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: BORDER,
      }}
    >
      <TextWidget text={label} style={{ color: MUTED, fontSize: 9, marginBottom: 4 }} />
      <TextWidget text={value} style={{ color: valueColor || TEXT, fontSize: 15, fontWeight: '700' }} />
      {sub ? (
        <TextWidget text={sub} style={{ color: subColor || MUTED, fontSize: 9, marginTop: 3 }} />
      ) : null}
    </FlexWidget>
  );
}

function TxRow({ merchant, amount, category }) {
  const color   = CAT_COLORS[category]   || MUTED;
  const initial = CAT_INITIALS[category] || '?';
  const name    = merchant.length > 20 ? merchant.slice(0, 19) + '…' : merchant;

  return (
    <FlexWidget
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: 'match_parent',
        paddingVertical: 5,
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget
          style={{
            width: 26,
            height: 26,
            backgroundColor: color + '28',
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 9,
          }}
        >
          <TextWidget text={initial} style={{ color, fontSize: 11, fontWeight: '700' }} />
        </FlexWidget>
        <TextWidget text={name} style={{ color: TEXT, fontSize: 12 }} />
      </FlexWidget>
      <TextWidget
        text={`-$${amount.toFixed(2)}`}
        style={{ color: TEXT, fontSize: 12, fontWeight: '600' }}
      />
    </FlexWidget>
  );
}

export function FinlitWidget({ width, height, budgetData, statsData, recentTxData }) {
  const compact = height < 220;

  const stats = statsData ? JSON.parse(statsData) : {};
  const {
    totalSpent       = 0,
    budgetLeft       = 0,
    budgetTotal      = 0,
    txCount          = 0,
    yesterdayTxCount = 0,
    todaySpent       = 0,
    yesterdaySpent   = 0,
    periodLabel      = 'This Month',
    periodRange      = '',
  } = stats;

  const recentTxs = recentTxData ? JSON.parse(recentTxData) : [];

  // Build day-grouped sections from recentTxs
  const grouped = [];
  let currentDay = null;
  recentTxs.forEach(tx => {
    const label = dayLabel(tx.date);
    if (label !== currentDay) {
      grouped.push({ type: 'header', label });
      currentDay = label;
    }
    grouped.push({ type: 'tx', ...tx });
  });

  // Stat deltas
  const spentDelta   = todaySpent - yesterdaySpent;
  const spentDeltaStr = spentDelta === 0 ? 'same as yesterday'
    : spentDelta > 0 ? `↑ $${Math.abs(spentDelta).toFixed(2)} today`
    : `↓ $${Math.abs(spentDelta).toFixed(2)} today`;
  const spentDeltaColor = spentDelta > 0 ? RED : GREEN;

  const txDelta    = txCount - yesterdayTxCount;
  const txDeltaStr = yesterdayTxCount > 0
    ? `vs ${yesterdayTxCount} yesterday`
    : periodRange || periodLabel;

  const noData = recentTxs.length === 0 && totalSpent === 0;

  // ── Compact ──────────────────────────────────────────────────────────────
  if (compact) {
    return (
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: BG,
          borderRadius: 20,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <ImageWidget
            image={require('../assets/finlit-logo.png')}
            imageWidth={88}
            imageHeight={40}
          />
          <FlexWidget
            style={{
              backgroundColor: SURFACE,
              borderRadius: 10,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: BORDER,
              marginTop: 12,
            }}
            clickAction="OPEN_URI"
            clickActionData={{ uri: 'finlit://scan' }}
          >
            <TextWidget text="Scan Receipt" style={{ color: ACCENT, fontSize: 12, fontWeight: '600' }} />
          </FlexWidget>
        </FlexWidget>
        <FlexWidget style={{ width: 1, height: 'match_parent', backgroundColor: BORDER, marginHorizontal: 14 }} />
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget text={periodLabel} style={{ color: MUTED, fontSize: 10, marginBottom: 8 }} />
          <TextWidget text="Total Spent" style={{ color: MUTED, fontSize: 10 }} />
          <TextWidget
            text={`$${totalSpent.toFixed(2)}`}
            style={{ color: TEXT, fontSize: 18, fontWeight: '700', marginBottom: 10 }}
          />
          <TextWidget text="Budget Left" style={{ color: MUTED, fontSize: 10 }} />
          <TextWidget
            text={`$${budgetLeft.toFixed(2)}`}
            style={{ color: GREEN, fontSize: 18, fontWeight: '700' }}
          />
        </FlexWidget>
      </FlexWidget>
    );
  }

  // ── Full ─────────────────────────────────────────────────────────────────
  // How many rows can we fit? Estimate space after header+stats.
  const maxRows = height > 400 ? 12 : height > 320 ? 9 : 7;
  const displayRows = grouped.slice(0, maxRows);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: BG,
        borderRadius: 20,
        padding: 16,
        flexDirection: 'column',
      }}
    >
      {/* ── Header ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: 'match_parent',
          marginBottom: 8,
        }}
      >
        <FlexWidget style={{ flexDirection: 'column' }}>
          <ImageWidget
            image={require('../assets/finlit-logo.png')}
            imageWidth={88}
            imageHeight={40}
          />
          {periodRange ? (
            <TextWidget text={periodRange} style={{ color: MUTED, fontSize: 10, marginTop: 2 }} />
          ) : null}
        </FlexWidget>
        <FlexWidget
          style={{
            backgroundColor: SURFACE,
            borderRadius: 20,
            paddingVertical: 6,
            paddingHorizontal: 14,
            borderWidth: 1,
            borderColor: BORDER,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'finlit://scan' }}
        >
          <TextWidget text="Scan Receipt" style={{ color: ACCENT, fontSize: 10, fontWeight: '600' }} />
        </FlexWidget>
      </FlexWidget>

      {/* ── Stat row ── */}
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', gap: 7, marginBottom: 12 }}>
        <StatCard
          label="Total Spent"
          value={`$${totalSpent.toFixed(0)}`}
          sub={spentDeltaStr}
          subColor={spentDeltaColor}
        />
        <StatCard
          label="Budget Left"
          value={`$${budgetLeft.toFixed(0)}`}
          valueColor={budgetLeft > 0 ? GREEN : RED}
          sub={`of $${budgetTotal.toFixed(0)}`}
        />
        <StatCard
          label="Transactions"
          value={`${txCount}`}
          sub={txDeltaStr}
        />
      </FlexWidget>

      {/* ── Divider ── */}
      <FlexWidget style={{ height: 1, width: 'match_parent', backgroundColor: BORDER, marginBottom: 10 }} />

      {/* ── Transaction header ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: 'match_parent',
          marginBottom: 6,
        }}
      >
        <TextWidget text="Recent Transactions" style={{ color: TEXT, fontSize: 12, fontWeight: '700' }} />
        <TextWidget text="View All" style={{ color: ACCENT, fontSize: 11 }} />
      </FlexWidget>

      {/* ── Transaction list ── */}
      <FlexWidget style={{ flex: 1, width: 'match_parent' }}>
        {noData ? (
          <TextWidget
            text="Open Finlit and sync your bank to load transactions."
            style={{ color: MUTED, fontSize: 11, lineHeight: 17 }}
            maxLines={3}
          />
        ) : (
          displayRows.map((row, i) =>
            row.type === 'header' ? (
              <FlexWidget
                key={i}
                style={{
                  width: 'match_parent',
                  paddingTop: i === 0 ? 0 : 6,
                  paddingBottom: 3,
                  borderBottomWidth: 1,
                  borderBottomColor: BORDER,
                  marginBottom: 3,
                }}
              >
                <TextWidget
                  text={row.label.toUpperCase()}
                  style={{ color: MUTED, fontSize: 9, fontWeight: '700', letterSpacing: 1 }}
                />
              </FlexWidget>
            ) : (
              <TxRow
                key={i}
                merchant={row.merchant}
                amount={row.amount}
                category={row.category}
              />
            )
          )
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
