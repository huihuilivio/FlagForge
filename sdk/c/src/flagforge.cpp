/**
 * FlagForge C SDK — Implementation.
 *
 * This file is compiled as C++ but exposes a pure C ABI via extern "C".
 * It wraps the C++ FeatureManager into an opaque handle-based API.
 */
#include "flagforge.h"
#include "flagforge/feature_manager.h"

#include <string>
#include <cstring>
#include <vector>
#include <mutex>

/* ---- Internal instance structure ---- */
struct ff_instance {
    flagforge::Config       config;
    flagforge::UserContext   user_ctx;
    flagforge::FeatureManager* mgr;       /* borrowed from singleton */

    /* Stable storage for strings returned to C callers */
    mutable std::mutex      str_mutex;
    mutable std::string     last_value;   /* getValue return buffer */

    ff_update_callback_t    c_callback;
    void*                   c_user_data;

    ff_instance() : mgr(nullptr), c_callback(nullptr), c_user_data(nullptr) {}
};

/* ---- Helper: convert C user context to C++ ---- */
static flagforge::UserContext to_cpp_context(const ff_user_context_t* ctx) {
    flagforge::UserContext uc;
    if (!ctx) return uc;
    if (ctx->user_id)  uc.user_id  = ctx->user_id;
    if (ctx->version)  uc.version  = ctx->version;
    if (ctx->platform) uc.platform = ctx->platform;
    if (ctx->attrs && ctx->attr_count > 0) {
        for (size_t i = 0; i < ctx->attr_count; ++i) {
            if (ctx->attrs[i].key && ctx->attrs[i].value) {
                uc.attrs[ctx->attrs[i].key] = ctx->attrs[i].value;
            }
        }
    }
    return uc;
}

/* ---- Helper: convert C config to C++ ---- */
static flagforge::Config to_cpp_config(const ff_config_t* cfg) {
    flagforge::Config c;
    if (cfg->host)      c.host      = cfg->host;
    if (cfg->app_key)   c.app_key   = cfg->app_key;
    if (cfg->env_key)   c.env_key   = cfg->env_key;
    if (cfg->cache_file) c.cache_file = cfg->cache_file;
    c.port              = cfg->port;
    c.poll_interval_sec = cfg->poll_interval_sec;
    c.timeout_sec       = cfg->timeout_sec;
    return c;
}

/* ============================================================
 *  Lifecycle
 * ============================================================ */

extern "C" {

ff_handle_t ff_create(void) {
    auto* inst = new (std::nothrow) ff_instance();
    if (!inst) return nullptr;
    inst->mgr = &flagforge::FeatureManager::instance();
    return inst;
}

void ff_destroy(ff_handle_t ff) {
    if (!ff) return;
    ff_shutdown(ff);
    delete ff;
}

ff_config_t ff_config_default(void) {
    ff_config_t cfg;
    std::memset(&cfg, 0, sizeof(cfg));
    cfg.host              = "localhost";
    cfg.port              = 8080;
    cfg.poll_interval_sec = 30;
    cfg.timeout_sec       = 5;
    cfg.cache_file        = nullptr;
    return cfg;
}

int ff_init(ff_handle_t ff, const ff_config_t* config, const ff_user_context_t* ctx) {
    if (!ff || !config) return FF_ERR_NULL;
    if (!config->app_key || !config->env_key) return FF_ERR;

    ff->config   = to_cpp_config(config);
    ff->user_ctx = to_cpp_context(ctx);
    ff->mgr->init(ff->config, ff->user_ctx);
    return FF_OK;
}

int ff_set_user_context(ff_handle_t ff, const ff_user_context_t* ctx) {
    if (!ff) return FF_ERR_NULL;
    ff->user_ctx = to_cpp_context(ctx);
    ff->mgr->setUserContext(ff->user_ctx);
    return FF_OK;
}

int ff_refresh(ff_handle_t ff) {
    if (!ff) return FF_ERR_NULL;
    return ff->mgr->refresh() ? FF_OK : FF_ERR;
}

void ff_shutdown(ff_handle_t ff) {
    if (!ff) return;
    ff->mgr->shutdown();
}

/* ============================================================
 *  Queries
 * ============================================================ */

bool ff_is_enabled(ff_handle_t ff, const char* key) {
    if (!ff || !key) return false;
    return ff->mgr->isEnabled(key);
}

const char* ff_get_value(ff_handle_t ff, const char* key) {
    if (!ff || !key) return "";
    std::lock_guard<std::mutex> lock(ff->str_mutex);
    ff->last_value = ff->mgr->getValue(key);
    return ff->last_value.c_str();
}

int ff_get_feature(ff_handle_t ff, const char* key, ff_feature_t* out) {
    if (!ff || !key || !out) return FF_ERR_NULL;
    auto fr = ff->mgr->getFeature(key);
    /* Feature not found: enabled=false and value="" is the default.
       We distinguish "not found" by checking if the key actually exists. */
    auto all = ff->mgr->getAllFeatures();
    if (all.find(key) == all.end()) return FF_ERR;

    out->enabled = fr.enabled;
    /* Store value in stable buffer */
    std::lock_guard<std::mutex> lock(ff->str_mutex);
    ff->last_value = fr.value;
    out->value = ff->last_value.c_str();
    return FF_OK;
}

void ff_foreach_feature(ff_handle_t ff,
                        void (*cb)(const char* key, const ff_feature_t* feature, void* user_data),
                        void* user_data) {
    if (!ff || !cb) return;
    auto all = ff->mgr->getAllFeatures();
    for (auto& [key, fr] : all) {
        ff_feature_t f;
        f.enabled = fr.enabled;
        f.value   = fr.value.c_str();
        cb(key.c_str(), &f, user_data);
    }
}

size_t ff_feature_count(ff_handle_t ff) {
    if (!ff) return 0;
    return ff->mgr->getAllFeatures().size();
}

/* ============================================================
 *  Callback
 * ============================================================ */

void ff_on_update(ff_handle_t ff, ff_update_callback_t cb, void* user_data) {
    if (!ff) return;
    ff->c_callback  = cb;
    ff->c_user_data = user_data;

    if (cb) {
        /* Capture raw pointer — safe because ff_destroy shuts down first */
        ff_instance* inst = ff;
        ff->mgr->onUpdate([inst]() {
            if (inst->c_callback) {
                inst->c_callback(inst->c_user_data);
            }
        });
    } else {
        ff->mgr->onUpdate(nullptr);
    }
}

} /* extern "C" */
