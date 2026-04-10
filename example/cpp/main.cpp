#include <iostream>
#include <string>
#include "flagforge/feature_manager.h"

int main() {
    auto& fm = flagforge::FeatureManager::instance();

    // --- 1. Configure SDK ---
    flagforge::Config config;
    config.host = "localhost";
    config.port = 8080;
    config.app_key = "my_game";
    config.env_key = "dev";
    config.poll_interval_sec = 30;       // auto-refresh every 30s
    config.timeout_sec = 5;
    config.cache_file = "feature_cache.dat";  // offline resilience

    // --- 2. Set user context (for targeting rules) ---
    flagforge::UserContext ctx;
    ctx.user_id = "alice";
    ctx.version = "2.1.0";
    ctx.platform = "windows";
    ctx.attrs["region"] = "cn";

    // --- 3. Initialize (fetches features from server) ---
    fm.init(config, ctx);

    // --- 4. Register update callback (optional) ---
    fm.onUpdate([]() {
        std::cout << "[callback] features updated!" << std::endl;
    });

    // --- 5. Query features ---
    std::cout << "=== FlagForge C++ SDK Demo ===" << std::endl;

    // Boolean feature
    std::cout << "\n[dark_mode] "
              << (fm.isEnabled("dark_mode") ? "ENABLED" : "DISABLED")
              << std::endl;

    // String feature
    std::string welcome = fm.getValue("welcome_text");
    if (!welcome.empty()) {
        std::cout << "[welcome_text] " << welcome << std::endl;
    }

    // Get full result
    auto result = fm.getFeature("new_checkout");
    std::cout << "[new_checkout] enabled=" << result.enabled
              << " value=\"" << result.value << "\"" << std::endl;

    // List all features
    auto all = fm.getAllFeatures();
    std::cout << "\n--- All Features (" << all.size() << ") ---" << std::endl;
    for (auto& [key, fr] : all) {
        std::cout << "  " << key << ": "
                  << (fr.enabled ? "ON" : "OFF");
        if (!fr.value.empty())
            std::cout << " = " << fr.value;
        std::cout << std::endl;
    }

    // --- 6. Change user context (re-fetches) ---
    std::cout << "\n--- Switching to user bob ---" << std::endl;
    ctx.user_id = "bob";
    fm.setUserContext(ctx);

    std::cout << "[dark_mode] "
              << (fm.isEnabled("dark_mode") ? "ENABLED" : "DISABLED")
              << std::endl;

    // --- 7. Manual refresh ---
    std::cout << "\n--- Manual refresh ---" << std::endl;
    if (fm.refresh()) {
        std::cout << "Refresh succeeded" << std::endl;
    } else {
        std::cout << "Refresh failed (server unreachable?)" << std::endl;
    }

    // --- 8. Cleanup ---
    fm.shutdown();
    std::cout << "\nDone." << std::endl;
    return 0;
}
