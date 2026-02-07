import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const SCREEN_WIDTH = width;
export const SCREEN_HEIGHT = height;

export const CARD_HEIGHT = SCREEN_HEIGHT;
export const CARD_WIDTH = SCREEN_WIDTH;

export const PRELOAD_AHEAD = 5;
export const PRELOAD_BEHIND = 1;

export const SAVED_GRID_COLUMNS = 2;
export const SAVED_CARD_GAP = 12;
export const SAVED_CARD_WIDTH = (SCREEN_WIDTH - SAVED_CARD_GAP * 3) / SAVED_GRID_COLUMNS;
export const SAVED_CARD_HEIGHT = SAVED_CARD_WIDTH * 1.4;

export const TAB_BAR_HEIGHT = 80;

export const FEED_PAGE_SIZE = 15;
