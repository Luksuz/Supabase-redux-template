// lib/interceptors/fetch-interceptor.tsx
'use client';

import { useEffect } from 'react';

export function SetupFetchInterceptor() {
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (input, init) => {
      const startTime = performance.now();
      
      // Extract URL and method
      const url = typeof input === 'string' ? input : (input as Request).url;
      const method = init?.method || (typeof input !== 'string' && (input as Request).method) || 'GET';
      
      // Extract headers
      let headers: Record<string, string> = {};
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((value, key) => {
            headers[key] = value;
          });
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([key, value]) => {
            headers[key] = value;
          });
        } else {
          headers = { ...init.headers };
        }
      } else if (typeof input !== 'string' && input instanceof Request) {
        input.headers.forEach((value: string, key: string) => {
          headers[key] = value;
        });
      }

      // Extract body data
      let bodyData: any = null;
      let bodySize = 0;
      if (init?.body) {
        if (typeof init.body === 'string') {
          bodyData = init.body;
          bodySize = new Blob([init.body]).size;
        } else if (init.body instanceof FormData) {
          bodyData = 'FormData';
          // Try to extract FormData entries
          const formEntries: Record<string, any> = {};
          try {
            for (const [key, value] of init.body.entries()) {
              formEntries[key] = value instanceof File ? `File: ${value.name} (${value.size} bytes)` : value;
            }
            bodyData = { type: 'FormData', entries: formEntries };
          } catch (e) {
            bodyData = 'FormData (unable to extract entries)';
          }
        } else if (init.body instanceof Blob) {
          bodySize = init.body.size;
          bodyData = `Blob (${init.body.type || 'unknown type'}, ${bodySize} bytes)`;
        } else if (init.body instanceof ArrayBuffer) {
          bodySize = init.body.byteLength;
          bodyData = `ArrayBuffer (${bodySize} bytes)`;
        } else {
          bodyData = init.body.toString();
        }
      }

      // Client environment data
      const clientData = {
        // Request details
        request: {
          url,
          method,
          headers,
          body: bodyData,
          bodySize,
          credentials: init?.credentials || 'same-origin',
          cache: init?.cache || 'default',
          redirect: init?.redirect || 'follow',
          referrer: init?.referrer || document.referrer,
          referrerPolicy: init?.referrerPolicy || 'strict-origin-when-cross-origin',
          mode: init?.mode || 'cors',
          integrity: init?.integrity || null,
          keepalive: init?.keepalive || false,
          signal: init?.signal ? 'AbortSignal present' : null,
        },
        
        // Browser/Client environment
        client: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          languages: navigator.languages,
          cookieEnabled: navigator.cookieEnabled,
          onLine: navigator.onLine,
          hardwareConcurrency: navigator.hardwareConcurrency,
          deviceMemory: (navigator as any).deviceMemory,
          connection: (navigator as any).connection ? {
            effectiveType: (navigator as any).connection.effectiveType,
            downlink: (navigator as any).connection.downlink,
            rtt: (navigator as any).connection.rtt,
            saveData: (navigator as any).connection.saveData,
          } : null,
        },

        // Screen and viewport
        screen: {
          width: screen.width,
          height: screen.height,
          availWidth: screen.availWidth,
          availHeight: screen.availHeight,
          colorDepth: screen.colorDepth,
          pixelDepth: screen.pixelDepth,
          orientation: screen.orientation ? {
            angle: screen.orientation.angle,
            type: screen.orientation.type,
          } : null,
        },

        // Window/viewport info
        viewport: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          outerWidth: window.outerWidth,
          outerHeight: window.outerHeight,
          devicePixelRatio: window.devicePixelRatio,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
        },

        // Document info
        document: {
          url: document.URL,
          title: document.title,
          referrer: document.referrer,
          domain: document.domain,
          characterSet: document.characterSet,
          readyState: document.readyState,
          visibilityState: document.visibilityState,
          hidden: document.hidden,
        },

        // Location info
        location: {
          href: location.href,
          origin: location.origin,
          protocol: location.protocol,
          host: location.host,
          hostname: location.hostname,
          port: location.port,
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        },

        // Timing info
        timing: {
          requestStart: startTime,
          domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
          loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart,
        },

        // Storage availability
        storage: {
          localStorage: typeof Storage !== 'undefined' && window.localStorage !== undefined,
          sessionStorage: typeof Storage !== 'undefined' && window.sessionStorage !== undefined,
          indexedDB: typeof indexedDB !== 'undefined',
        },

        // Permissions (if available)
        permissions: {
          notifications: typeof Notification !== 'undefined' ? Notification.permission : 'unavailable',
          geolocation: typeof navigator.geolocation !== 'undefined' ? 'available' : 'unavailable',
        },

        // Feature detection
        features: {
          webGL: !!window.WebGLRenderingContext,
          webGL2: !!window.WebGL2RenderingContext,
          webRTC: !!(window as any).RTCPeerConnection,
          serviceWorker: 'serviceWorker' in navigator,
          pushManager: 'PushManager' in window,
          webWorker: typeof Worker !== 'undefined',
          fetch: typeof fetch !== 'undefined',
          websocket: typeof WebSocket !== 'undefined',
          canvas: !!document.createElement('canvas').getContext,
          audio: !!document.createElement('audio').canPlayType,
          video: !!document.createElement('video').canPlayType,
        },
      };

      console.log('🔍 [FETCH INTERCEPTOR] Complete Request Data:', clientData);

      try {
        const response = await originalFetch(input, init);
        const endTime = performance.now();
        const duration = endTime - startTime;

        // Extract response data
        const responseData = {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          redirected: response.redirected,
          type: response.type,
          url: response.url,
          headers: {},
          timing: {
            duration,
            endTime,
          },
        };

        // Extract response headers
        response.headers.forEach((value, key) => {
          (responseData.headers as any)[key] = value;
        });

        console.log('✅ [FETCH INTERCEPTOR] Response Data:', responseData);

        // Try to clone and peek at response body (non-destructive)
        try {
          const clonedResponse = response.clone();
          const contentType = response.headers.get('content-type');
          
          if (contentType?.includes('application/json')) {
            const jsonData = await clonedResponse.json();
            console.log('📄 [FETCH INTERCEPTOR] Response JSON:', jsonData);
          } else if (contentType?.includes('text/')) {
            const textData = await clonedResponse.text();
            console.log('📝 [FETCH INTERCEPTOR] Response Text:', textData.substring(0, 500) + (textData.length > 500 ? '...' : ''));
          }
        } catch (e) {
          console.log('⚠️ [FETCH INTERCEPTOR] Could not peek at response body:', e);
        }

        return response;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.error('❌ [FETCH INTERCEPTOR] Request Failed:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          duration,
          url,
          method,
        });
        
        throw error;
      }
    };

    // Cleanup function
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}

/*
// JSON Schema for the intercepted data (commented out as requested)

{
  "type": "object",
  "properties": {
    "request": {
      "type": "object",
      "properties": {
        "url": { "type": "string" },
        "method": { "type": "string" },
        "headers": { "type": "object" },
        "body": { "type": ["string", "object", "null"] },
        "bodySize": { "type": "number" },
        "credentials": { "type": "string" },
        "cache": { "type": "string" },
        "redirect": { "type": "string" },
        "referrer": { "type": "string" },
        "referrerPolicy": { "type": "string" },
        "mode": { "type": "string" },
        "integrity": { "type": ["string", "null"] },
        "keepalive": { "type": "boolean" },
        "signal": { "type": ["string", "null"] }
      }
    },
    "client": {
      "type": "object",
      "properties": {
        "userAgent": { "type": "string" },
        "platform": { "type": "string" },
        "language": { "type": "string" },
        "languages": { "type": "array", "items": { "type": "string" } },
        "cookieEnabled": { "type": "boolean" },
        "onLine": { "type": "boolean" },
        "hardwareConcurrency": { "type": "number" },
        "deviceMemory": { "type": ["number", "undefined"] },
        "connection": {
          "type": ["object", "null"],
          "properties": {
            "effectiveType": { "type": "string" },
            "downlink": { "type": "number" },
            "rtt": { "type": "number" },
            "saveData": { "type": "boolean" }
          }
        }
      }
    },
    "screen": {
      "type": "object",
      "properties": {
        "width": { "type": "number" },
        "height": { "type": "number" },
        "availWidth": { "type": "number" },
        "availHeight": { "type": "number" },
        "colorDepth": { "type": "number" },
        "pixelDepth": { "type": "number" },
        "orientation": {
          "type": ["object", "null"],
          "properties": {
            "angle": { "type": "number" },
            "type": { "type": "string" }
          }
        }
      }
    },
    "viewport": {
      "type": "object",
      "properties": {
        "innerWidth": { "type": "number" },
        "innerHeight": { "type": "number" },
        "outerWidth": { "type": "number" },
        "outerHeight": { "type": "number" },
        "devicePixelRatio": { "type": "number" },
        "scrollX": { "type": "number" },
        "scrollY": { "type": "number" }
      }
    },
    "document": {
      "type": "object",
      "properties": {
        "url": { "type": "string" },
        "title": { "type": "string" },
        "referrer": { "type": "string" },
        "domain": { "type": "string" },
        "characterSet": { "type": "string" },
        "readyState": { "type": "string" },
        "visibilityState": { "type": "string" },
        "hidden": { "type": "boolean" }
      }
    },
    "location": {
      "type": "object",
      "properties": {
        "href": { "type": "string" },
        "origin": { "type": "string" },
        "protocol": { "type": "string" },
        "host": { "type": "string" },
        "hostname": { "type": "string" },
        "port": { "type": "string" },
        "pathname": { "type": "string" },
        "search": { "type": "string" },
        "hash": { "type": "string" }
      }
    },
    "timing": {
      "type": "object",
      "properties": {
        "requestStart": { "type": "number" },
        "domContentLoaded": { "type": "number" },
        "loadComplete": { "type": "number" }
      }
    },
    "storage": {
      "type": "object",
      "properties": {
        "localStorage": { "type": "boolean" },
        "sessionStorage": { "type": "boolean" },
        "indexedDB": { "type": "boolean" }
      }
    },
    "permissions": {
      "type": "object",
      "properties": {
        "notifications": { "type": "string" },
        "geolocation": { "type": "string" }
      }
    },
    "features": {
      "type": "object",
      "properties": {
        "webGL": { "type": "boolean" },
        "webGL2": { "type": "boolean" },
        "webRTC": { "type": "boolean" },
        "serviceWorker": { "type": "boolean" },
        "pushManager": { "type": "boolean" },
        "webWorker": { "type": "boolean" },
        "fetch": { "type": "boolean" },
        "websocket": { "type": "boolean" },
        "canvas": { "type": "boolean" },
        "audio": { "type": "boolean" },
        "video": { "type": "boolean" }
      }
    }
  }
}
*/