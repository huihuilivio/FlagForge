#pragma once

#include <string>
#include <unordered_map>
#include <mutex>

namespace flagforge {

class FeatureManager {
public:
    static FeatureManager& instance();

    void init(const std::string& url);

    bool isEnabled(const std::string& key);
    std::string getValue(const std::string& key);

private:
    FeatureManager() = default;
    FeatureManager(const FeatureManager&) = delete;
    FeatureManager& operator=(const FeatureManager&) = delete;

    void loadLocalCache();
    void fetchRemote();

private:
    std::string server_url_;
    std::unordered_map<std::string, bool> bool_features_;
    std::unordered_map<std::string, std::string> string_features_;
    std::mutex mutex_;
};

} // namespace flagforge
