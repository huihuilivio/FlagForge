#include <iostream>
#include "flagforge/feature_manager.h"

int main() {
    auto& fm = flagforge::FeatureManager::instance();
    fm.init("http://localhost:8080/api/v1/features");

    if (fm.isEnabled("new_ui")) {
        std::cout << "new_ui is enabled" << std::endl;
    } else {
        std::cout << "new_ui is disabled" << std::endl;
    }

    std::string theme = fm.getValue("theme_color");
    std::cout << "theme_color = " << theme << std::endl;

    return 0;
}
