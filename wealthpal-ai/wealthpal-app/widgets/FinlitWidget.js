import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

const PROMPTS = [
  { id: 'BUDGET', label: '💰 Budget' },
  { id: 'SPENDING', label: '📊 Spending' },
  { id: 'TIP', label: '💡 Tip' },
];

export function FinlitWidget({ width, height, response, activePrompt, isLoading }) {
  const compact = height < 140;
  const displayText = response || 'Tap a question below for an instant AI answer.';

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        backgroundColor: '#0d1520',
        borderRadius: 22,
        padding: 14,
      }}
    >
      {/* Header */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: 'match_parent',
          marginBottom: compact ? 6 : 10,
        }}
      >
        <FlexWidget
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            backgroundColor: '#16b7f6',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 8,
          }}
        >
          <TextWidget
            text="✦"
            style={{ color: '#ffffff', fontSize: 14, textAlign: 'center' }}
          />
        </FlexWidget>
        <TextWidget
          text="Finlit AI"
          style={{ color: '#eef2ff', fontSize: 13, fontWeight: 'bold', flex: 1 }}
        />
        <TextWidget
          text="· AI"
          style={{ color: '#16b7f6', fontSize: 10 }}
        />
      </FlexWidget>

      {/* AI Response area */}
      <FlexWidget
        style={{
          flex: 1,
          width: 'match_parent',
          backgroundColor: '#131f30',
          borderRadius: 12,
          padding: 10,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: '#1e2f42',
        }}
      >
        <TextWidget
          text={isLoading ? '⏳  Thinking...' : displayText}
          style={{
            color: isLoading ? '#4a6070' : '#b8ccd8',
            fontSize: 12,
            lineHeight: 18,
            fontStyle: isLoading ? 'italic' : 'normal',
          }}
          maxLines={compact ? 3 : 5}
          truncate="END"
        />
      </FlexWidget>

      {/* Quick prompt chips */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          justifyContent: 'space-between',
          marginBottom: 7,
          flexGap: 5,
        }}
      >
        {PROMPTS.map(({ id, label }) => (
          <FlexWidget
            key={id}
            style={{
              flex: 1,
              backgroundColor: activePrompt === id ? '#16b7f6' : '#1a2b3c',
              borderRadius: 9,
              paddingVertical: 6,
              paddingHorizontal: 4,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: activePrompt === id ? 0 : 1,
              borderColor: '#253545',
            }}
            clickAction={id}
            clickActionData={{}}
          >
            <TextWidget
              text={label}
              style={{
                color: activePrompt === id ? '#ffffff' : '#7a9ab0',
                fontSize: 10,
                textAlign: 'center',
                fontWeight: activePrompt === id ? 'bold' : 'normal',
              }}
            />
          </FlexWidget>
        ))}
      </FlexWidget>

      {/* Open full chat button */}
      <FlexWidget
        style={{
          backgroundColor: '#16b7f6',
          borderRadius: 10,
          paddingVertical: 7,
          justifyContent: 'center',
          alignItems: 'center',
          width: 'match_parent',
        }}
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'finlit://chat' }}
      >
        <TextWidget
          text="Open Full Chat  →"
          style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
