/**
 * FlagForge C SDK — Pure C API for feature flag evaluation.
 *
 * Thread-safe. Uses an opaque handle to manage SDK lifetime.
 * Internally delegates to the C++ implementation via extern "C" wrapper.
 *
 * Typical usage:
 *   ff_handle_t ff = ff_create();
 *   ff_config_t cfg = ff_config_default();
 *   cfg.app_key = "my_app"; cfg.env_key = "dev";
 *   ff_init(ff, &cfg, NULL);
 *   if (ff_is_enabled(ff, "dark_mode")) { ... }
 *   ff_destroy(ff);
 */
#ifndef FLAGFORGE_H
#define FLAGFORGE_H

#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* ---- Opaque handle ---- */
typedef struct ff_instance* ff_handle_t;

/* ---- Configuration ---- */
typedef struct ff_config {
    const char* host;               /* server host (default: "localhost") */
    int         port;               /* server port (default: 8080) */
    const char* app_key;            /* required */
    const char* env_key;            /* required */
    int         poll_interval_sec;  /* auto-refresh interval, 0 = disable (default: 30) */
    int         timeout_sec;        /* HTTP timeout (default: 5) */
    const char* cache_file;         /* local cache path, NULL = disable */
} ff_config_t;

/* ---- User context for targeting rules ---- */
typedef struct ff_attr {
    const char* key;
    const char* value;
} ff_attr_t;

typedef struct ff_user_context {
    const char*     user_id;
    const char*     version;
    const char*     platform;
    const ff_attr_t* attrs;          /* array of key-value pairs, end with {NULL,NULL} */
    size_t          attr_count;      /* number of attrs (ignored if attrs==NULL) */
} ff_user_context_t;

/* ---- Feature result ---- */
typedef struct ff_feature {
    bool        enabled;
    const char* value;               /* string value, empty string if none */
} ff_feature_t;

/* ---- Callback ---- */
typedef void (*ff_update_callback_t)(void* user_data);

/* ---- Lifecycle ---- */

/** Create a new SDK instance. Must be destroyed with ff_destroy(). */
ff_handle_t ff_create(void);

/** Destroy the SDK instance and release all resources. */
void ff_destroy(ff_handle_t ff);

/** Return a default configuration with sensible defaults. */
ff_config_t ff_config_default(void);

/** Initialize the SDK (fetches features from server). */
int ff_init(ff_handle_t ff, const ff_config_t* config, const ff_user_context_t* ctx);

/** Update user context and re-fetch features. */
int ff_set_user_context(ff_handle_t ff, const ff_user_context_t* ctx);

/** Force a refresh from the server. Returns 0 on success, -1 on failure. */
int ff_refresh(ff_handle_t ff);

/** Shutdown background polling. Called automatically by ff_destroy(). */
void ff_shutdown(ff_handle_t ff);

/* ---- Queries ---- */

/** Check whether a feature is enabled. */
bool ff_is_enabled(ff_handle_t ff, const char* key);

/**
 * Get the string value of a feature.
 * The returned pointer is valid until the next ff_refresh/ff_set_user_context/ff_destroy.
 * Returns empty string "" if feature not found.
 */
const char* ff_get_value(ff_handle_t ff, const char* key);

/**
 * Get full feature result. Caller provides a ff_feature_t to fill.
 * Returns 0 if feature found, -1 if not found.
 */
int ff_get_feature(ff_handle_t ff, const char* key, ff_feature_t* out);

/**
 * Iterate all features.
 * Calls `cb(key, feature, user_data)` for each feature.
 */
void ff_foreach_feature(ff_handle_t ff,
                        void (*cb)(const char* key, const ff_feature_t* feature, void* user_data),
                        void* user_data);

/** Get the number of cached features. */
size_t ff_feature_count(ff_handle_t ff);

/* ---- Callback ---- */

/** Register a callback invoked when features are updated. */
void ff_on_update(ff_handle_t ff, ff_update_callback_t cb, void* user_data);

/* ---- Error codes ---- */
#define FF_OK        0
#define FF_ERR      -1
#define FF_ERR_NULL -2

#ifdef __cplusplus
}
#endif

#endif /* FLAGFORGE_H */
