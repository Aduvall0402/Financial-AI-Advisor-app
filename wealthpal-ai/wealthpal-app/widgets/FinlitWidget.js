import React from 'react';
import { FlexWidget, TextWidget, ImageWidget } from 'react-native-android-widget';

const ACCENT = '#16b7f6';
const BG = '#07111f';
const SURFACE = '#0e1e30';
const BORDER = '#172536';
const TEXT = '#ddeeff';
const MUTED = '#4a6a88';
const GREEN = '#22c55e';
const AMBER = '#f59e0b';
const RED = '#ef4444';

const CAT_COLORS = {
  GROCERY: '#3b82f6',
  DINING: '#22c55e',
  TRANSPORT: '#f59e0b',
  ENTERTAINMENT: '#a855f7',
  SHOPPING: '#ec4899',
  TRAVEL: '#06b6d4',
  HEALTH: '#10b981',
  UTILITIES: '#6366f1',
  PERSONAL_CARE: '#f472b6',
  EDUCATION: '#8b5cf6',
  OTHER: '#64748b',
};

function CategoryRow({ label, category, spent, limit, pct }) {
  const barWidth = Math.min(100, Math.max(0, pct));
  const overBudget = pct >= 100;
  const color = CAT_COLORS[category] || ACCENT;
  const barColor = overBudget ? RED : pct >= 80 ? AMBER : color;
  const remaining = Math.max(0, limit - spent);
  const remainColor = overBudget ? RED : GREEN;

  return (
    <FlexWidget style={{ width: 'match_parent', marginBottom: 8 }}>
      {/* Icon + name row */}
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <FlexWidget
            style={{
              width: 24,
              height: 24,
              backgroundColor: color + '30',
              borderRadius: 7,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 7,
            }}
          >
            <TextWidget text={label[0]} style={{ color, fontSize: 11, fontWeight: '700' }} />
          </FlexWidget>
          <TextWidget text={label} style={{ color: TEXT, fontSize: 11, fontWeight: '600' }} />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextWidget
            text={`$${remaining.toFixed(0)} left`}
            style={{ color: remainColor, fontSize: 10, fontWeight: '600', marginRight: 8 }}
          />
          <TextWidget text={`${Math.round(pct)}%`} style={{ color: MUTED, fontSize: 10 }} />
        </FlexWidget>
      </FlexWidget>
      {/* Progress bar */}
      <FlexWidget style={{ height: 3, width: 'match_parent', backgroundColor: BORDER, borderRadius: 2, marginBottom: 2 }}>
        <FlexWidget
          style={{ height: 3, width: `${barWidth}%`, backgroundColor: barColor, borderRadius: 2 }}
        />
      </FlexWidget>
      {/* Spent / limit label */}
      <TextWidget
        text={`$${spent.toFixed(0)} of $${limit.toFixed(0)}`}
        style={{ color: MUTED, fontSize: 9 }}
      />
    </FlexWidget>
  );
}

export function FinlitWidget({ width, height, budgetData, statsData }) {
  const compact = height < 200;
  const budgets = budgetData ? JSON.parse(budgetData) : [];
  const stats = statsData ? JSON.parse(statsData) : {};

  const {
    totalSpent = 0,
    budgetLeft = 0,
    budgetTotal = 0,
    txCount = 0,
    todaySpent = 0,
    yesterdaySpent = 0,
    todayDate = '',
    periodLabel = 'This Period',
  } = stats;

  const todayDelta = todaySpent - yesterdaySpent;
  const deltaStr = todayDelta === 0
    ? 'same as yesterday'
    : todayDelta > 0
      ? `+$${Math.abs(todayDelta).toFixed(0)} vs yesterday`
      : `-$${Math.abs(todayDelta).toFixed(0)} vs yesterday`;
  const deltaColor = todayDelta > 0 ? RED : GREEN;

  if (compact) {
    return (
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: BG,
          borderRadius: 20,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {/* Left: logo + scan button */}
        <FlexWidget style={{ flex: 1, flexDirection: 'column', justifyContent: 'space-between' }}>
          <ImageWidget
            image={require('../assets/finlit-logo.png')}
            imageWidth={72}
            imageHeight={26}
          />
          <FlexWidget
            style={{
              backgroundColor: SURFACE,
              borderRadius: 8,
              paddingVertical: 7,
              paddingHorizontal: 10,
              borderWidth: 1,
              borderColor: BORDER,
              marginTop: 12,
            }}
            clickAction="OPEN_URI"
            clickActionData={{ uri: 'finlit://scan' }}
          >
            <TextWidget
              text="Scan Receipt"
              style={{ color: TEXT, fontSize: 11, fontWeight: '600' }}
            />
          </FlexWidget>
        </FlexWidget>

        {/* Vertical divider */}
        <FlexWidget
          style={{ width: 1, height: 'match_parent', backgroundColor: BORDER, marginHorizontal: 14 }}
        />

        {/* Right: stats */}
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text={periodLabel} style={{ color: MUTED, fontSize: 9, marginBottom: 6 }} />
          <TextWidget text="Total Spent" style={{ color: MUTED, fontSize: 10 }} />
          <TextWidget
            text={`$${totalSpent.toFixed(2)}`}
            style={{ color: TEXT, fontSize: 17, fontWeight: '700', marginBottom: 8 }}
          />
          <TextWidget text="Budget Left" style={{ color: MUTED, fontSize: 10 }} />
          <TextWidget
            text={`$${budgetLeft.toFixed(2)}`}
            style={{ color: GREEN, fontSize: 17, fontWeight: '700' }}
          />
        </FlexWidget>
      </FlexWidget>
    );
  }

  // Full / large widget
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: BG,
        borderRadius: 20,
        padding: 14,
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: 'match_parent',
          marginBottom: 10,
        }}
      >
        <FlexWidget style={{ flexDirection: 'column' }}>
          <ImageWidget
            image={require('../assets/finlit-logo.png')}
            imageWidth={68}
            imageHeight={24}
          />
          <TextWidget
            text="Today's Summary"
            style={{ color: TEXT, fontSize: 12, fontWeight: '700', marginTop: 4 }}
          />
          {todayDate ? (
            <TextWidget text={todayDate} style={{ color: MUTED, fontSize: 10 }} />
          ) : null}
        </FlexWidget>
        <FlexWidget
          style={{
            backgroundColor: SURFACE,
            borderRadius: 20,
            paddingVertical: 5,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: BORDER,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'finlit://scan' }}
        >
          <TextWidget text="Scan Receipt" style={{ color: ACCENT, fontSize: 10, fontWeight: '600' }} />
        </FlexWidget>
      </FlexWidget>

      {/* Stats row */}
      <FlexWidget
        style={{ flexDirection: 'row', width: 'match_parent', gap: 6, marginBottom: 10 }}
      >
        {/* Total Spent */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: SURFACE,
            borderRadius: 10,
            padding: 8,
            borderWidth: 1,
            borderColor: BORDER,
          }}
        >
          <TextWidget text="Total Spent" style={{ color: MUTED, fontSize: 9, marginBottom: 3 }} />
          <TextWidget
            text={`$${totalSpent.toFixed(0)}`}
            style={{ color: TEXT, fontSize: 14, fontWeight: '700' }}
          />
          <TextWidget text={deltaStr} style={{ color: deltaColor, fontSize: 9, marginTop: 2 }} />
        </FlexWidget>
        {/* Budget Left */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: SURFACE,
            borderRadius: 10,
            padding: 8,
            borderWidth: 1,
            borderColor: BORDER,
          }}
        >
          <TextWidget text="Budget Left" style={{ color: MUTED, fontSize: 9, marginBottom: 3 }} />
          <TextWidget
            text={`$${budgetLeft.toFixed(0)}`}
            style={{ color: GREEN, fontSize: 14, fontWeight: '700' }}
          />
          <TextWidget
            text={`of $${budgetTotal.toFixed(0)}`}
            style={{ color: MUTED, fontSize: 9, marginTop: 2 }}
          />
        </FlexWidget>
        {/* Transactions */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: SURFACE,
            borderRadius: 10,
            padding: 8,
            borderWidth: 1,
            borderColor: BORDER,
          }}
        >
          <TextWidget
            text="Transactions"
            style={{ color: MUTED, fontSize: 9, marginBottom: 3 }}
          />
          <TextWidget
            text={`${txCount}`}
            style={{ color: TEXT, fontSize: 14, fontWeight: '700' }}
          />
          <TextWidget
            text={periodLabel}
            style={{ color: MUTED, fontSize: 9, marginTop: 2 }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Divider */}
      <FlexWidget
        style={{ height: 1, width: 'match_parent', backgroundColor: BORDER, marginBottom: 8 }}
      />

      {/* Category header */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: 'match_parent',
          marginBottom: 8,
        }}
      >
        <TextWidget
          text="Spending by Category"
          style={{ color: TEXT, fontSize: 12, fontWeight: '700' }}
        />
        <TextWidget text="View All" style={{ color: ACCENT, fontSize: 11 }} />
      </FlexWidget>

      {/* Category rows */}
      <FlexWidget style={{ flex: 1, width: 'match_parent' }}>
        {budgets.length === 0 ? (
          <TextWidget
            text="No budgets set. Open Finlit to create budgets."
            style={{ color: MUTED, fontSize: 11 }}
            maxLines={2}
          />
        ) : (
          budgets.slice(0, 5).map((b, i) => (
            <CategoryRow
              key={i}
              label={b.label}
              category={b.category}
              spent={b.spent}
              limit={b.limit}
              pct={b.pct}
            />
          ))
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
