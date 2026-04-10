/**
 * FlagForge C SDK — Example Demo
 *
 * Demonstrates: init, query, callback, user context switch, refresh, shutdown.
 * Compile as C (this file is pure C, linked against the C++ wrapper library).
 */
#include <stdio.h>
#include <string.h>
#include "flagforge.h"

/* Callback: invoked when features are updated */
static void on_features_updated(void* user_data) {
    (void)user_data;
    printf("[callback] features updated!\n");
}

/* Iterator callback: print each feature */
static void print_feature(const char* key, const ff_feature_t* f, void* user_data) {
    (void)user_data;
    printf("  %s: %s", key, f->enabled ? "ON" : "OFF");
    if (f->value && f->value[0] != '\0') {
        printf(" = %s", f->value);
    }
    printf("\n");
}

int main(void) {
    /* 1. Create SDK instance */
    ff_handle_t ff = ff_create();
    if (!ff) {
        fprintf(stderr, "Failed to create FlagForge instance\n");
        return 1;
    }

    /* 2. Configure */
    ff_config_t cfg = ff_config_default();
    cfg.app_key    = "my_game";
    cfg.env_key    = "dev";
    cfg.cache_file = "feature_cache.dat";
    cfg.poll_interval_sec = 30;

    /* 3. User context */
    ff_attr_t attrs[] = {
        { "region", "cn" },
    };
    ff_user_context_t ctx = {0};
    ctx.user_id    = "alice";
    ctx.version    = "2.1.0";
    ctx.platform   = "windows";
    ctx.attrs      = attrs;
    ctx.attr_count = sizeof(attrs) / sizeof(attrs[0]);

    /* 4. Initialize (fetches features from server) */
    if (ff_init(ff, &cfg, &ctx) != FF_OK) {
        fprintf(stderr, "ff_init failed\n");
        ff_destroy(ff);
        return 1;
    }

    /* 5. Register update callback */
    ff_on_update(ff, on_features_updated, NULL);

    /* 6. Query features */
    printf("=== FlagForge C SDK Demo ===\n\n");

    /* Boolean feature */
    printf("[dark_mode] %s\n",
           ff_is_enabled(ff, "dark_mode") ? "ENABLED" : "DISABLED");

    /* String feature */
    const char* welcome = ff_get_value(ff, "welcome_text");
    if (welcome && welcome[0] != '\0') {
        printf("[welcome_text] %s\n", welcome);
    }

    /* Full feature result */
    ff_feature_t result;
    if (ff_get_feature(ff, "new_checkout", &result) == FF_OK) {
        printf("[new_checkout] enabled=%d value=\"%s\"\n",
               result.enabled, result.value);
    }

    /* List all features */
    printf("\n--- All Features (%zu) ---\n", ff_feature_count(ff));
    ff_foreach_feature(ff, print_feature, NULL);

    /* 7. Switch user context */
    printf("\n--- Switching to user bob ---\n");
    ctx.user_id = "bob";
    ff_set_user_context(ff, &ctx);

    printf("[dark_mode] %s\n",
           ff_is_enabled(ff, "dark_mode") ? "ENABLED" : "DISABLED");

    /* 8. Manual refresh */
    printf("\n--- Manual refresh ---\n");
    if (ff_refresh(ff) == FF_OK) {
        printf("Refresh succeeded\n");
    } else {
        printf("Refresh failed (server unreachable?)\n");
    }

    /* 9. Cleanup */
    ff_destroy(ff);
    printf("\nDone.\n");
    return 0;
}
