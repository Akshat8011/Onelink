import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Image, StyleSheet, Platform, type ImageStyle, type StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CATEGORY_COLORS: Record<string, string> = {
  MOVIE: '#6366F1',
  MUSIC: '#EC4899',
  COMEDY: '#F59E0B',
  SPORTS: '#10B981',
  THEATRE: '#8B5CF6',
  WORKSHOP: '#06B6D4',
};

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  MOVIE: 'film',
  MUSIC: 'musical-notes',
  COMEDY: 'happy',
  SPORTS: 'football',
  THEATRE: 'ticket',
  WORKSHOP: 'color-palette',
};

function normalizePosterUrl(url?: string): string {
  if (!url?.trim()) return '';
  let normalized = url.trim();
  if (normalized.includes('-portrait.')) {
    normalized = normalized.replace('-portrait.', '-landscape.');
  }
  if (!normalized.includes('tr:w-') && normalized.includes('bmscdn.com')) {
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash !== -1) {
      normalized = normalized.slice(0, lastSlash) + '/tr:w-600,h-400,fo-auto' + normalized.slice(lastSlash);
    }
  }
  return normalized;
}

function isValidBmsImageUrl(url?: string): boolean {
  if (!url?.trim()) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('bmscdn.com') ||
    lower.includes('bookmyshow') ||
    lower.includes('bmsimages.com')
  );
}

interface EventPosterProps {
  imageUrl?: string;
  category?: string;
  style?: StyleProp<ImageStyle>;
}

export default function EventPoster({ imageUrl, category = 'THEATRE', style }: EventPosterProps) {
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  const posterUrl = useMemo(() => {
    if (!imageUrl || !isValidBmsImageUrl(imageUrl)) return '';
    return normalizePosterUrl(imageUrl);
  }, [imageUrl]);

  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.THEATRE;
  const icon = CATEGORY_ICONS[category] || 'sparkles';
  const flat = StyleSheet.flatten(style) || {};
  const width = (flat.width as number) || 80;
  const height = (flat.height as number) || 100;
  const borderRadius = (flat.borderRadius as number) || 8;

  useEffect(() => {
    setFailed(false);
    setLoadAttempt(0);
  }, [imageUrl]);

  const handleError = useCallback(() => {
    if (loadAttempt < 2) {
      setLoadAttempt(prev => prev + 1);
    } else {
      setFailed(true);
    }
  }, [loadAttempt]);

  const hasImage = Boolean(posterUrl) && !failed;

  if (!hasImage) {
    return (
      <View style={[styles.placeholder, { width, height, borderRadius, backgroundColor: color + '33' }]}>
        <Ionicons name={icon} size={Math.min(width, height) * 0.35} color={color} />
      </View>
    );
  }

  const finalUrl = loadAttempt > 0 ? `${posterUrl}?retry=${loadAttempt}` : posterUrl;

  if (Platform.OS === 'web') {
    return (
      <View style={[style as object, styles.webImageContainer]}>
        <img
          src={finalUrl}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: borderRadius,
          }}
          onError={handleError}
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: finalUrl }}
      style={style}
      resizeMode="cover"
      onError={handleError}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  webImageContainer: { overflow: 'hidden' },
});
