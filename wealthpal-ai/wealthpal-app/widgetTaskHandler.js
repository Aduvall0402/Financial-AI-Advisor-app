import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { FinlitWidget } from './widgets/FinlitWidget';

const API_URL = 'https://financial-ai-advisor-app-production.up.railway.app';

const PROMPTS = {
  BUDGET: 'How is my budget doing this pay period? Give a concise 2-sentence answer with specific numbers if possible.',
  SPENDING: 'Give me a brief 2-sentence summary of my recent spending, highlighting the top category.',
};

function fmtTime() {
  const d = new Date();
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
}

async function widgetTaskHandler({ widgetAction, widgetInfo, renderWidget, clickAction }) {
  const userId = await AsyncStorage.getItem('widgetUserId');
  const lastResponse = await AsyncStorage.getItem('widgetLastResponse') || '';
  const lastUpdated = await AsyncStorage.getItem('widgetLastUpdated') || '';
  const lastPrompt = await AsyncStorage.getItem('widgetLastPrompt') || '';

  const renderDefault = (response, prompt) =>
    renderWidget(
      <FinlitWidget
        width={widgetInfo.width}
        height={widgetInfo.height}
        response={response}
        activePrompt={prompt}
        isLoading={false}
        lastUpdated={lastUpdated}
      />
    );

  if (!userId) {
    renderDefault('Open Finlit and sign in to see your AI financial snapshot here.', '');
    return;
  }

  const isPromptClick = widgetAction === 'WIDGET_CLICK' && PROMPTS[clickAction];

  if (isPromptClick) {
    // Show loading
    renderWidget(
      <FinlitWidget
        width={widgetInfo.width}
        height={widgetInfo.height}
        response=""
        activePrompt={clickAction}
        isLoading={true}
        lastUpdated={lastUpdated}
      />
    );

    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message: PROMPTS[clickAction], today, history: [] }),
      });

      const data = await res.json();
      let response;

      if (res.status === 429) {
        response = 'AI limit reached. Open Finlit to upgrade for unlimited access.';
      } else if (!res.ok) {
        response = 'Could not get a response. Try again in a moment.';
      } else {
        response = data.response || 'No response received.';
      }

      const timeStr = fmtTime();
      await AsyncStorage.setItem('widgetLastResponse', response);
      await AsyncStorage.setItem('widgetLastUpdated', timeStr);
      await AsyncStorage.setItem('widgetLastPrompt', clickAction);

      renderWidget(
        <FinlitWidget
          width={widgetInfo.width}
          height={widgetInfo.height}
          response={response}
          activePrompt={clickAction}
          isLoading={false}
          lastUpdated={timeStr}
        />
      );
    } catch {
      renderDefault('No connection. Check your internet and try again.', clickAction);
    }
    return;
  }

  // Default: show last response or placeholder
  renderDefault(
    lastResponse || 'Tap Budget or Spending for an instant AI answer.',
    lastPrompt,
  );
}

registerWidgetTaskHandler(widgetTaskHandler);
