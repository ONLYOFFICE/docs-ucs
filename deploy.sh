#!/bin/bash

ucsver="5.0"
app_ver="$version"
appcenterctl=~/univention-appcenter-control

if [ ! -f $appcenterctl ]; then
    curl https://provider-portal.software-univention.de/appcenter-selfservice/univention-appcenter-control --output $appcenterctl
    chmod +x $appcenterctl
fi

app_ini=$(find . -maxdepth 1 -name "*.ini" | head -n 1)
app_name=$(basename "$app_ini" .ini)

if [ -z "$app_ini" ]; then
    echo -e "No ini files found. Nothing to publish"
    exit 1
fi
#привет
sed -i "s|appversion|$app_ver|" "$app_ini"
sed -i "s|imageversion|$app_ver|" "$app_ini"

$appcenterctl new-version --username $username --pwdfile $passfile $ucsver/$app_name $ucsver/$app_name=$app_ver

file_list=$(ls)

$appcenterctl upload --username $username --pwdfile $passfile --noninteractive $ucsver/$app_name=$app_ver $file_list 
