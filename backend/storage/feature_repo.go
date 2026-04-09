package storage

import "github.com/livio/flagforge/backend/model"

type FeatureRepo struct{}

func (r *FeatureRepo) FindAll() ([]model.Feature, error) {
	// TODO
	return nil, nil
}

func (r *FeatureRepo) FindByKey(key string) (*model.Feature, error) {
	// TODO
	return nil, nil
}

func (r *FeatureRepo) Create(feature *model.Feature) error {
	// TODO
	return nil
}

func (r *FeatureRepo) Update(feature *model.Feature) error {
	// TODO
	return nil
}

func (r *FeatureRepo) Delete(id int) error {
	// TODO
	return nil
}
