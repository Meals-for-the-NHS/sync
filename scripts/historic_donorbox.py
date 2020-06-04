import json
from os import environ
import requests
import csv

cache_name = 'all_donations.json'

try:
    with open(cache_name) as f:
        donations = json.load(f)
    print(f'loaded {len(donations)} from cache')
except FileNotFoundError:
    donations = []

page, per_page = 1, 100
auth  = environ.get('DONORBOX_EMAIL'), environ.get('DONORBOX_API_KEY')
up_to_date = False

while not up_to_date:
    params = {
        'per_page': per_page,
        'page': page
    }

    response = requests.get('https://donorbox.org/api/v1/donations',
                            params=params, auth=auth)

    donation_ids = set([d['id'] for d in donations])

    if response.status_code == 200:
        payload = json.loads(response.text)
        to_add = [d for d in payload if d['id'] not in donation_ids]
        donations.extend(to_add)
        page += 1
        up_to_date = len(to_add) != per_page
        print(f'added {len(to_add)}, total {len(donations)}')

with open(cache_name, 'w') as f:
    json.dump(donations, f)

print(f'saved {len(donations)}')

with open('donations.csv', 'w') as f:
    fieldnames = [k for k, v in donations[0].items()
                  if k != 'id' and type(v) != 'dict']
    fieldnames.insert(0, 'id') # first field for Airtable index
    print(fieldnames)
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    for donation in sorted(donations, key=lambda e: e['donation_date']):
        for key in list(donation.keys()):
            if key not in fieldnames:
                del donation[key]
        writer.writerow(donation)
