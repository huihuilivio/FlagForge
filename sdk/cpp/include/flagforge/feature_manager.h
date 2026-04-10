#pragma once

#include <string>
#include <unordered_map>
#include <functional>
#include <memory>

namespace flagforge {

/// Feature evaluation result from the server.
struct FeatureResult {
    bool enabled = false;
    std::string value;
};

/// User context sent with each evaluation request.
struct UserContext {
    std::string user_id;
    std::string version;
    std::string platform;
    std::unordered_map<std::string, std::string> attrs; // attr_key -> value
};

/// SDK configuration.
struct Config {
    std::string host = "localhost";
    int port = 8080;
    std::string app_key;
    std::string env_key;
    int poll_interval_sec = 30;     // auto-refresh interval (0 = disable)
    int timeout_sec = 5;            // HTTP timeout
    std::string cache_file;         // local cache path (empty = disable)
};

/// Callback for feature update events.
using UpdateCallback = std::function<void()>;

class FeatureManager {
public:
    static FeatureManager& instance();

    /// Initialize the SDK. Must be called once before any query.
    void init(const Config& config);

    /// Initialize with a user context for targeting rules.
    void init(const Config& config, const UserContext& ctx);

    /// Update user context and re-fetch features.
    void setUserContext(const UserContext& ctx);

    /// Force a refresh from the server.
    bool refresh();

    /// Query whether a feature is enabled.
    bool isEnabled(const std::string& key) const;

    /// Query the value of a feature (string / json types).
    std::string getValue(const std::string& key) const;

    /// Get the full evaluation result for a feature.
    FeatureResult getFeature(const std::string& key) const;

    /// Get all features as a map.
    std::unordered_map<std::string, FeatureResult> getAllFeatures() const;

    /// Register a callback invoked when features are updated.
    void onUpdate(UpdateCallback cb);

    /// Shutdown the background polling thread.
    void shutdown();

    ~FeatureManager();

private:
    FeatureManager();
    FeatureManager(const FeatureManager&) = delete;
    FeatureManager& operator=(const FeatureManager&) = delete;

    class Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace flagforge
