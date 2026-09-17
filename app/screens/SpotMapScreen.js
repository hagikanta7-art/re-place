import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';
import * as Location from 'expo-location';
import { subscribeToSpots, latestVisit } from '../core/spots';

const DEFAULT_CENTER = { lat: 35.681236, lng: 139.767125 }; // 東京駅（フォールバック）

const CATEGORY_ICON = {
  飲食: '🍜',
  美容: '✂️',
  通院: '🏥',
  バイト: '💼',
  学習: '📚',
  仕事: '💼',
};

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function buildHtml(spots, center, currentLocation) {
  const markers = spots
    .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
    .map((s) => {
      const last = latestVisit(s);
      return {
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        name: escapeHtml(s.name || '場所'),
        icon: CATEGORY_ICON[s.category] || '📍',
        category: escapeHtml(s.category || '未分類'),
        preview: escapeHtml(last?.goodPoint || last?.content || ''),
      };
    });

  const firstMarker = markers[0];
  // 登録済みの場所があればそれを優先、無ければ現在地、それも無ければ東京駅を中心にする
  const centerLat = firstMarker ? firstMarker.lat : currentLocation?.lat ?? center.lat;
  const centerLng = firstMarker ? firstMarker.lng : currentLocation?.lng ?? center.lng;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    body { background: #f5f7fb; }
    .leaflet-control-attribution { font-size: 10px; }
    .spot-label {
      background: #fff;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 2px 8px;
      font-size: 12px;
      font-weight: 600;
      color: #1F2937;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    }
    .spot-label::before { display: none; }
    .spot-popup { min-width: 160px; }
    .spot-popup-title { font-size: 14px; font-weight: 700; color: #1F2937; }
    .spot-popup-category { font-size: 11px; color: #6B7280; margin-top: 2px; }
    .spot-popup-preview { font-size: 12px; color: #374151; margin-top: 6px; }
    .spot-popup-button {
      margin-top: 8px;
      width: 100%;
      background: #2F6FED;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 6px 0;
      font-size: 12px;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${centerLat}, ${centerLng}], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    var markers = ${JSON.stringify(markers)};
    markers.forEach(function (m) {
      var marker = L.marker([m.lat, m.lng]).addTo(map);

      // 常に地図上に名前を表示（タップしなくても分かるように）
      marker.bindTooltip(m.icon + ' ' + m.name, {
        permanent: true,
        direction: 'top',
        offset: [0, -8],
        className: 'spot-label',
      });

      // タップするとカテゴリ・前回の内容も含めたポップアップを表示。
      // ここではまだ画面遷移しない（ボタンを押したときだけ遷移する）
      var popupHtml =
        '<div class="spot-popup">' +
        '<div class="spot-popup-title">' + m.icon + ' ' + m.name + '</div>' +
        '<div class="spot-popup-category">' + m.category + '</div>' +
        (m.preview ? '<div class="spot-popup-preview">◎ ' + m.preview + '</div>' : '') +
        '<button class="spot-popup-button" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({spotId:\\'' + m.id + '\\'}))">カルテを開く ›</button>' +
        '</div>';
      marker.bindPopup(popupHtml);
    });

    if (markers.length > 0) {
      var bounds = L.latLngBounds(markers.map(function (m) { return [m.lat, m.lng]; }));
      map.fitBounds(bounds.pad(0.3));
    }

    // 「現在地」を示す青い丸。React Native側から位置が取れるたびに更新される。
    var currentLocationMarker = null;
    window.setCurrentLocation = function (lat, lng) {
      var latlng = [lat, lng];
      if (currentLocationMarker) {
        currentLocationMarker.setLatLng(latlng);
      } else {
        currentLocationMarker = L.circleMarker(latlng, {
          radius: 8,
          color: '#fff',
          weight: 2,
          fillColor: '#2f6fed',
          fillOpacity: 1,
        }).addTo(map);
      }
    };
    ${
      currentLocation
        ? `window.setCurrentLocation(${currentLocation.lat}, ${currentLocation.lng});`
        : ''
    }
  </script>
</body>
</html>
`;
}

export default function SpotMapScreen({ navigation }) {
  const [spots, setSpots] = useState([]);
  // 地図の初期表示位置を決めるためだけに使う値（一度取得したら地図を作り直す）。
  // ライブの現在地更新は webviewRef 経由の injectJavaScript で行い、
  // 地図（ズーム・パン状態）を作り直さないようにする。
  const [initialLocation, setInitialLocation] = useState(null);
  const webviewRef = useRef(null);

  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;

    const unsubscribe = subscribeToSpots(uid, setSpots);
    return unsubscribe;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const position = await Location.getCurrentPositionAsync({});
        setInitialLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      } catch (e) {
        // 取得できなくても地図自体は表示できるので無視する
      }
    })();
  }, []);

  // このタブを表示している間だけ現在地を監視し、青い丸をリアルタイムで更新する。
  // （以前は起動時に1回取得するだけで、タブを切り替えて戻ってきても
  //   アプリを再起動しないと更新されなかった）
  useFocusEffect(
    useCallback(() => {
      let subscription;
      let cancelled = false;
      (async () => {
        try {
          const sub = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 5 },
            (position) => {
              webviewRef.current?.injectJavaScript(
                `window.setCurrentLocation && window.setCurrentLocation(${position.coords.latitude}, ${position.coords.longitude}); true;`
              );
            }
          );
          if (cancelled) {
            sub.remove();
          } else {
            subscription = sub;
          }
        } catch (e) {
          // 取得できなくても地図自体は使えるので無視する
        }
      })();
      return () => {
        cancelled = true;
        subscription?.remove();
      };
    }, [])
  );

  const validSpots = useMemo(
    () => spots.filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number'),
    [spots]
  );

  const html = useMemo(
    () => buildHtml(validSpots, DEFAULT_CENTER, initialLocation),
    [validSpots, initialLocation]
  );

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.spotId) {
        navigation.navigate('SpotDetail', { spotId: data.spotId });
      }
    } catch (e) {
      console.log('map message parse error', e);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>地図</Text>
      </View>

      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={handleMessage}
        style={styles.webview}
      />
      {validSpots.length === 0 && (
        <View style={styles.emptyBanner}>
          <Text style={styles.emptyTitle}>まだ場所がありません</Text>
          <Text style={styles.emptyText}>一覧から場所を追加して地図に表示しましょう。</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  emptyBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  emptyText: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  webview: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
});
