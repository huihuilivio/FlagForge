#include "flagforge/feature_manager.h"
#include "httplib.h"
#include "nlohmann/json.hpp"
#include <fstream>
#include <sstream>
#include <iostream>
#include <mutex>
#include <thread>
#include <atomic>
#include <chrono>
#include <cctype>

using json = nlohmann::json;

namespace flagforge {

// ============================================================
//  Impl — all private state and logic hidden from the header
// ============================================================
class FeatureManager::Impl {
public:
    void init(const Config& config, const UserContext& ctx) {
        // Guard against double-init: stop previous poll thread first
        shutdown();

        int poll_sec;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            config_ = config;
            user_ctx_ = ctx;
            features_.clear();  // discard stale data from previous init
            poll_sec = config_.poll_interval_sec;
        }
        loadCache();
        fetchRemote();
        if (poll_sec > 0) {
            running_ = true;
            poll_thread_ = std::thread(&Impl::pollLoop, this);
        }
    }

    void setUserContext(const UserContext& ctx) {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            user_ctx_ = ctx;
        }
        fetchRemote();
    }

    bool refresh() { return fetchRemote(); }

    bool isEnabled(const std::string& key) const {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = features_.find(key);
        return it != features_.end() && it->second.enabled;
    }

    std::string getValue(const std::string& key) const {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = features_.find(key);
        return it != features_.end() ? it->second.value : "";
    }

    FeatureResult getFeature(const std::string& key) const {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = features_.find(key);
        return it != features_.end() ? it->second : FeatureResult{};
    }

    std::unordered_map<std::string, FeatureResult> getAllFeatures() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return features_;
    }

    void onUpdate(UpdateCallback cb) {
        std::lock_guard<std::mutex> lock(mutex_);
        update_cb_ = std::move(cb);
    }

    void shutdown() {
        bool expected = true;
        if (running_.compare_exchange_strong(expected, false)) {
            if (poll_thread_.joinable()) {
                poll_thread_.join();
            }
        }
    }

    ~Impl() { shutdown(); }

private:
    static std::string urlEncode(const std::string& s) {
        std::ostringstream out;
        for (unsigned char c : s) {
            if (std::isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') {
                out << c;
            } else {
                out << '%' << std::uppercase << std::hex
                    << ((c >> 4) & 0xF) << (c & 0xF);
            }
        }
        return out.str();
    }

    std::string buildQueryString() const {
        std::ostringstream qs;
        qs << "/api/v1/features?app_key=" << urlEncode(config_.app_key)
           << "&env_key=" << urlEncode(config_.env_key);
        if (!user_ctx_.user_id.empty())
            qs << "&user_id=" << urlEncode(user_ctx_.user_id);
        if (!user_ctx_.version.empty())
            qs << "&version=" << urlEncode(user_ctx_.version);
        if (!user_ctx_.platform.empty())
            qs << "&platform=" << urlEncode(user_ctx_.platform);
        for (auto& [k, v] : user_ctx_.attrs)
            qs << "&attr_" << urlEncode(k) << "=" << urlEncode(v);
        return qs.str();
    }

    bool fetchRemote() {
        std::string path, host;
        int port, timeout;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            path = buildQueryString();
            host = config_.host;
            port = config_.port;
            timeout = config_.timeout_sec;
        }

        httplib::Client cli(host, port);
        cli.set_connection_timeout(timeout);
        cli.set_read_timeout(timeout);

        auto res = cli.Get(path);
        if (!res || res->status != 200) {
            std::cerr << "[FlagForge] fetch failed: "
                      << (res ? std::to_string(res->status) : "connection error")
                      << std::endl;
            return false;
        }

        try {
            auto j = json::parse(res->body);
            std::unordered_map<std::string, FeatureResult> new_features;
            for (auto& [key, val] : j.items()) {
                FeatureResult fr;
                fr.enabled = val.value("enabled", false);
                fr.value = val.value("value", "");
                new_features[key] = std::move(fr);
            }

            UpdateCallback cb;
            std::string cache_file;
            {
                std::lock_guard<std::mutex> lock(mutex_);
                features_ = std::move(new_features);
                cb = update_cb_;
                cache_file = config_.cache_file;
            }

            saveCacheUnlocked(cache_file);
            if (cb) cb();
            return true;
        } catch (const std::exception& e) {
            std::cerr << "[FlagForge] parse error: " << e.what() << std::endl;
            return false;
        }
    }

    // XOR obfuscation key for local cache file
    static constexpr const char* kObfuscateKey = "FlagForge@2026";

    static std::string xorObfuscate(const std::string& data) {
        const std::string key(kObfuscateKey);
        std::string result(data.size(), '\0');
        for (size_t i = 0; i < data.size(); ++i) {
            result[i] = data[i] ^ key[i % key.size()];
        }
        return result;
    }

    void saveCacheUnlocked(const std::string& cache_file) const {
        if (cache_file.empty()) return;
        try {
            json j = json::object();
            {
                std::lock_guard<std::mutex> lock(mutex_);
                for (auto& [key, fr] : features_) {
                    j[key] = {{"enabled", fr.enabled}, {"value", fr.value}};
                }
            }
            // XOR obfuscate then write binary
            std::string plain = j.dump(2);
            std::string obfuscated = xorObfuscate(plain);
            std::ofstream ofs(cache_file, std::ios::binary);
            if (ofs.is_open()) ofs.write(obfuscated.data(), obfuscated.size());
        } catch (...) {}
    }

    void loadCache() {
        std::lock_guard<std::mutex> lock(mutex_);
        if (config_.cache_file.empty()) return;
        try {
            std::ifstream ifs(config_.cache_file, std::ios::binary);
            if (!ifs.is_open()) return;
            std::string obfuscated((std::istreambuf_iterator<char>(ifs)),
                                    std::istreambuf_iterator<char>());
            if (obfuscated.empty()) return;
            std::string plain = xorObfuscate(obfuscated);
            auto j = json::parse(plain);
            for (auto& [key, val] : j.items()) {
                FeatureResult fr;
                fr.enabled = val.value("enabled", false);
                fr.value = val.value("value", "");
                features_[key] = std::move(fr);
            }
        } catch (...) {}
    }

    void pollLoop() {
        while (running_) {
            int interval;
            {
                std::lock_guard<std::mutex> lock(mutex_);
                interval = config_.poll_interval_sec;
            }
            for (int i = 0; i < interval * 10 && running_; ++i) {
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
            }
            if (running_) fetchRemote();
        }
    }

private:
    Config config_;
    UserContext user_ctx_;
    std::unordered_map<std::string, FeatureResult> features_;
    mutable std::mutex mutex_;
    UpdateCallback update_cb_;
    std::thread poll_thread_;
    std::atomic<bool> running_{false};
};

// ============================================================
//  FeatureManager — thin forwarding shell
// ============================================================
FeatureManager::FeatureManager() : impl_(std::make_unique<Impl>()) {}
FeatureManager::~FeatureManager() = default;

FeatureManager& FeatureManager::instance() {
    static FeatureManager inst;
    return inst;
}

void FeatureManager::init(const Config& config) { impl_->init(config, {}); }
void FeatureManager::init(const Config& config, const UserContext& ctx) { impl_->init(config, ctx); }
void FeatureManager::setUserContext(const UserContext& ctx) { impl_->setUserContext(ctx); }
bool FeatureManager::refresh() { return impl_->refresh(); }
bool FeatureManager::isEnabled(const std::string& key) const { return impl_->isEnabled(key); }
std::string FeatureManager::getValue(const std::string& key) const { return impl_->getValue(key); }
FeatureResult FeatureManager::getFeature(const std::string& key) const { return impl_->getFeature(key); }
std::unordered_map<std::string, FeatureResult> FeatureManager::getAllFeatures() const { return impl_->getAllFeatures(); }
void FeatureManager::onUpdate(UpdateCallback cb) { impl_->onUpdate(std::move(cb)); }
void FeatureManager::shutdown() { impl_->shutdown(); }

} // namespace flagforge
