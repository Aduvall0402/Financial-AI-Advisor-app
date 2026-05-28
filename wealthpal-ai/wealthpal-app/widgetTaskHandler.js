import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { FinlitWidget } from './widgets/FinlitWidget';

async function widgetTaskHandler({ widgetAction, widgetInfo, renderWidget, clickAction }) {
  const newsletter = await AsyncStorage.getItem('widgetDailyNewsletter') || '';
  const budgetData = await AsyncStorage.getItem('widgetBudgetData') || '';
  const newsletterDate = await AsyncStorage.getItem('widgetNewsletterDate') || '';

  const renderHome = () =>
    renderWidget(
      <FinlitWidget
        width={widgetInfo.width}
        height={widgetInfo.height}
        view="home"
        newsletter={newsletter}
        budgetData={budgetData}
        newsletterDate={newsletterDate}
      />
    );

  const renderBudget = () =>
    renderWidget(
      <FinlitWidget
        width={widgetInfo.width}
        height={widgetInfo.height}
        view="budget"
        newsletter={newsletter}
        budgetData={budgetData}
        newsletterDate={newsletterDate}
      />
    );

  if (widgetAction === 'WIDGET_CLICK') {
    if (clickAction === 'SHOW_BUDGET') {
      renderBudget();
      return;
    }
    if (clickAction === 'SHOW_HOME') {
      renderHome();
      return;
    }
    // OPEN_URI actions (Scan Receipt) are handled by the OS via clickActionData
  }

  // Default: WIDGET_ADDED, WIDGET_UPDATE, WIDGET_RESIZED
  renderHome();
}

registerWidgetTaskHandler(widgetTaskHandler);
