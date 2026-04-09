#include "flagforge/feature_manager.h"

namespace flagforge {

FeatureManager& FeatureManager::instance() {
    static FeatureManager inst;
    return inst;
}

void FeatureManager::init(const std::string& url) {
    server_url_ = url;
    loadLocalCache();
    fetchRemote();
}

bool FeatureManager::isEnabled(const std::string& key) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = bool_features_.find(key);
    if (it != bool_features_.end()) {
        return it->second;
    }
    return false;
}

std::string FeatureManager::getValue(const std::string& key) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = string_features_.find(key);
    if (it != string_features_.end()) {
        return it->second;
    }
    return "";
}

void FeatureManager::loadLocalCache() {
    // TODO: 从 feature_cache.json 加载本地缓存
}

void FeatureManager::fetchRemote() {
    // TODO: 异步拉取远程配置并更新 features_
}

} // namespace flagforge
