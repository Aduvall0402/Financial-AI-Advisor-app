import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export function FinlitWidget({ width, height, response, activePrompt, isLoading, lastUpdated }) {
  const compact = height < 150;

  const displayText = isLoading
    ? 'Fetching your financial snapshot...'
    : response || 'Tap Budget or Spending for an instant AI answer.';

  const timeLabel = lastUpdated
    ? `Updated ${lastUpdated}`
    : 'Tap to refresh';

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: '#0a0f1e',
        borderRadius: 24,
        padding: 16,
      }}
    >
      {/* Header row */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: 'match_parent',
          marginBottom: 10,
        }}
      >
        <FlexWidget
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            backgroundColor: '#16b7f6',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 8,
          }}
        >
          <TextWidget
            text="F"
            style={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold', textAlign: 'center' }}
          />
        </FlexWidget>
        <TextWidget
          text="Finlit"
          style={{ color: '#f0f4ff', fontSize: 14, fontWeight: 'bold', flex: 1 }}
        />
        <TextWidget
          text={timeLabel}
          style={{ color: '#3a4f6a', fontSize: 9 }}
        />
      </FlexWidget>

      {/* Divider */}
      <FlexWidget
        style={{
          height: 1,
          width: 'match_parent',
          backgroundColor: '#151f30',
          marginBottom: 10,
        }}
      />

      {/* AI response area */}
      <FlexWidget
        style={{
          flex: 1,
          width: 'match_parent',
          marginBottom: 10,
        }}
      >
        <TextWidget
          text={displayText}
          style={{
            color: isLoading ? '#3a5470' : '#c8dae8',
            fontSize: compact ? 11 : 12,
            lineHeight: compact ? 17 : 19,
            fontStyle: isLoading ? 'italic' : 'normal',
          }}
          maxLines={compact ? 3 : 6}
          truncate="END"
        />
      </FlexWidget>

      {/* Action row */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          gap: 6,
        }}
      >
        {/* Budget chip */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: activePrompt === 'BUDGET' ? '#16b7f6' : '#101828',
            borderRadius: 10,
            paddingVertical: 8,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: activePrompt === 'BUDGET' ? '#16b7f6' : '#1e2d42',
          }}
          clickAction="BUDGET"
          clickActionData={{}}
        >
          <TextWidget
            text="Budget"
            style={{
              color: activePrompt === 'BUDGET' ? '#ffffff' : '#5a7a9a',
              fontSize: 11,
              fontWeight: activePrompt === 'BUDGET' ? 'bold' : 'normal',
              textAlign: 'center',
            }}
          />
        </FlexWidget>

        {/* Spending chip */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: activePrompt === 'SPENDING' ? '#16b7f6' : '#101828',
            borderRadius: 10,
            paddingVertical: 8,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: activePrompt === 'SPENDING' ? '#16b7f6' : '#1e2d42',
          }}
          clickAction="SPENDING"
          clickActionData={{}}
        >
          <TextWidget
            text="Spending"
            style={{
              color: activePrompt === 'SPENDING' ? '#ffffff' : '#5a7a9a',
              fontSize: 11,
              fontWeight: activePrompt === 'SPENDING' ? 'bold' : 'normal',
              textAlign: 'center',
            }}
          />
        </FlexWidget>

        {/* Voice button */}
        <FlexWidget
          style={{
            width: 36,
            backgroundColor: '#101828',
            borderRadius: 10,
            paddingVertical: 8,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#1e2d42',
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'finlit://voice' }}
        >
          <TextWidget
            text="mic"
            style={{ color: '#16b7f6', fontSize: 11, textAlign: 'center' }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
